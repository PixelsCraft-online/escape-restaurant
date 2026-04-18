const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { adminAuth } = require('../middleware/auth');

// ==================== ANALYTICS ====================

// GET /api/admin/analytics — Today's stats
router.get('/analytics', adminAuth, async (req, res) => {
  const { prisma } = req;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [totalOrders, paidBills, tables, allOrders] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.bill.findMany({ where: { isPaid: true, createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.table.findMany(),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfDay, lte: endOfDay } },
        include: { items: { include: { menuItem: true } } },
      }),
    ]);

    const totalRevenue = paidBills.reduce((sum, b) => sum + b.total, 0);
    const avgOrderValue = paidBills.length > 0 ? totalRevenue / paidBills.length : 0;
    const tablesOccupied = tables.filter((t) => t.isOccupied).length;

    // Hourly order volume (0-23)
    const hourlyVolume = Array(24).fill(0);
    allOrders.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      hourlyVolume[hour]++;
    });
    const hourlyData = hourlyVolume.map((count, hour) => ({ hour: `${hour}:00`, orders: count }));

    // Revenue by category
    const categoryRevenue = {};
    allOrders.forEach((order) => {
      order.items.forEach((item) => {
        const cat = item.menuItem.category;
        if (!categoryRevenue[cat]) categoryRevenue[cat] = 0;
        categoryRevenue[cat] += item.price * item.quantity;
      });
    });
    const categoryData = Object.entries(categoryRevenue).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

    // Top items
    const itemStats = {};
    allOrders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.menuItemId;
        if (!itemStats[key]) {
          itemStats[key] = {
            name: item.menuItem.name,
            category: item.menuItem.category,
            count: 0,
            revenue: 0,
          };
        }
        itemStats[key].count += item.quantity;
        itemStats[key].revenue += item.price * item.quantity;
      });
    });
    const topItems = Object.values(itemStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((i) => ({ ...i, revenue: parseFloat(i.revenue.toFixed(2)) }));

    res.json({
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      tablesOccupied,
      totalTables: tables.length,
      hourlyData,
      categoryData,
      topItems,
      tables: tables.map((t) => ({
        id: t.id,
        tableNumber: t.tableNumber,
        isOccupied: t.isOccupied,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/analytics/week — 7-day revenue trend
router.get('/analytics/week', adminAuth, async (req, res) => {
  const { prisma } = req;
  try {
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const bills = await prisma.bill.findMany({
        where: { isPaid: true, createdAt: { gte: start, lte: end } },
      });
      const revenue = bills.reduce((sum, b) => sum + b.total, 0);
      weekData.push({
        date: start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        revenue: parseFloat(revenue.toFixed(2)),
      });
    }
    res.json(weekData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weekly data' });
  }
});

// GET /api/admin/export — CSV download
router.get('/export', adminAuth, async (req, res) => {
  const { prisma } = req;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        bill: true,
      },
    });

    const rows = [['Order ID', 'Table', 'Item', 'Category', 'Qty', 'Price', 'Item Total', 'Order Status', 'Order Time']];
    orders.forEach((order) => {
      order.items.forEach((item) => {
        rows.push([
          order.id,
          `T${order.table.tableNumber}`,
          item.menuItem.name,
          item.menuItem.category,
          item.quantity,
          item.price,
          (item.price * item.quantity).toFixed(2),
          order.status,
          new Date(order.createdAt).toLocaleTimeString('en-IN'),
        ]);
      });
    });

    const csv = rows.map((r) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=escape-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// PATCH /api/admin/menu/:id — Toggle item availability
router.patch('/menu/:id', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);
  const { isAvailable } = req.body;

  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable },
    });

    // Broadcast to all panels
    io.emit('menu_item_toggled', { menuItemId: id, isAvailable });

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle menu item' });
  }
});

// ==================== MENU CRUD ====================

// POST /api/admin/menu — Create a new menu item
router.post('/menu', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const { name, category, price, isVeg, imageUrl, prepTime, isSpecial } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'name, category, and price are required' });
  }

  try {
    const item = await prisma.menuItem.create({
      data: {
        name,
        category,
        price: parseFloat(price),
        isVeg: isVeg ?? true,
        imageUrl: imageUrl || null,
        prepTime: prepTime ? parseInt(prepTime) : null,
        isSpecial: isSpecial ?? false,
        isAvailable: true
      }
    });

    // Broadcast menu update
    io.emit('menu_updated', { action: 'created', item });

    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// PUT /api/admin/menu/:id — Update a menu item
router.put('/menu/:id', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);
  const { name, category, price, isVeg, imageUrl, prepTime, isSpecial, isAvailable } = req.body;

  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(isVeg !== undefined && { isVeg }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(prepTime !== undefined && { prepTime: prepTime ? parseInt(prepTime) : null }),
        ...(isSpecial !== undefined && { isSpecial }),
        ...(isAvailable !== undefined && { isAvailable })
      }
    });

    // Broadcast menu update
    io.emit('menu_updated', { action: 'updated', item });

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// DELETE /api/admin/menu/:id — Delete a menu item
router.delete('/menu/:id', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);

  try {
    // Check if item has been used in any orders
    const orderItems = await prisma.orderItem.findFirst({
      where: { menuItemId: id }
    });

    if (orderItems) {
      // Soft delete - just make it unavailable
      const item = await prisma.menuItem.update({
        where: { id },
        data: { isAvailable: false }
      });
      
      io.emit('menu_updated', { action: 'disabled', item });
      
      return res.json({ message: 'Item has order history, marked as unavailable instead', item });
    }

    // Hard delete if no orders
    await prisma.menuItem.delete({ where: { id } });
    
    io.emit('menu_updated', { action: 'deleted', menuItemId: id });

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// ==================== TABLE MANAGEMENT ====================

// GET /api/admin/tables — Get all tables with session info
router.get('/tables', adminAuth, async (req, res) => {
  const { prisma } = req;

  try {
    const tables = await prisma.table.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        orders: {
          where: { status: { not: 'BILLED' } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Get active sessions
    const sessions = await prisma.tableSession.findMany({
      where: { isActive: true, expiresAt: { gt: new Date() } }
    });

    const sessionMap = {};
    sessions.forEach(s => { sessionMap[s.tableNumber] = s; });

    const result = tables.map(t => ({
      id: t.id,
      tableNumber: t.tableNumber,
      qrCode: t.qrCode,
      isOccupied: t.isOccupied,
      activeSession: sessionMap[t.tableNumber] || null,
      currentOrder: t.orders[0] || null
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// POST /api/admin/tables — Create a new table
router.post('/tables', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const { tableNumber } = req.body;

  if (!tableNumber || typeof tableNumber !== 'number') {
    return res.status(400).json({ error: 'Valid tableNumber is required' });
  }

  try {
    // Check if table number already exists
    const existing = await prisma.table.findUnique({ where: { tableNumber } });
    if (existing) {
      return res.status(409).json({ error: 'Table number already exists' });
    }

    const table = await prisma.table.create({
      data: { tableNumber }
    });

    io.emit('table_created', table);
    res.status(201).json(table);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/admin/tables/:id — Update table
router.put('/tables/:id', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);
  const { tableNumber, isOccupied } = req.body;

  try {
    // If changing table number, check for conflicts
    if (tableNumber) {
      const existing = await prisma.table.findFirst({
        where: { tableNumber, id: { not: id } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Table number already exists' });
      }
    }

    const table = await prisma.table.update({
      where: { id },
      data: {
        ...(tableNumber && { tableNumber }),
        ...(isOccupied !== undefined && { isOccupied })
      }
    });

    io.emit('table_updated', table);
    res.json(table);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// DELETE /api/admin/tables/:id — Delete a table
router.delete('/tables/:id', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);

  try {
    // Check if table has any orders
    const orders = await prisma.order.findFirst({ where: { tableId: id } });
    if (orders) {
      return res.status(400).json({ error: 'Cannot delete table with order history' });
    }

    // Delete any sessions
    const table = await prisma.table.findUnique({ where: { id } });
    if (table) {
      await prisma.tableSession.deleteMany({ where: { tableNumber: table.tableNumber } });
    }

    await prisma.table.delete({ where: { id } });

    io.emit('table_deleted', { id, tableNumber: table?.tableNumber });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// POST /api/admin/tables/:id/reset — Reset a table (end session, mark free)
router.post('/tables/:id/reset', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);
  console.log('Resetting table with id:', id);

  try {
    const table = await prisma.table.update({
      where: { id },
      data: { isOccupied: false }
    });
    console.log('Table updated:', table);

    // End any active sessions
    const updatedSessions = await prisma.tableSession.updateMany({
      where: { tableNumber: table.tableNumber, isActive: true },
      data: { isActive: false }
    });
    console.log('Sessions updated:', updatedSessions);

    // Notify customers on this table that session has ended
    io.to(`table_${table.tableNumber}`).emit('session_ended', { 
      message: 'Thank you for dining with us! Your bill has been settled.' 
    });
    io.emit('table_updated', { ...table, isOccupied: false });

    res.json({ success: true, table });
  } catch (err) {
    console.error('Reset table error:', err);
    res.status(500).json({ error: 'Failed to reset table' });
  }
});

// ==================== ORDER HISTORY ====================

// GET /api/admin/orders — Get order history with filters
router.get('/orders', adminAuth, async (req, res) => {
  const { prisma } = req;
  const { startDate, endDate, status, tableNumber, search, page = 1, limit = 20 } = req.query;

  try {
    const where = {};

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = status;
    }

    // Table filter
    if (tableNumber) {
      where.table = { tableNumber: parseInt(tableNumber) };
    }

    // Search by item name
    if (search) {
      where.items = {
        some: {
          menuItem: {
            name: { contains: search, mode: 'insensitive' }
          }
        }
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          table: true,
          items: { include: { menuItem: true } },
          bill: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/admin/orders/:id — Get single order details
router.get('/orders/:id', adminAuth, async (req, res) => {
  const { prisma } = req;
  const id = parseInt(req.params.id);

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        table: true,
        items: { include: { menuItem: true } },
        bill: { include: { feedback: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ==================== DATE RANGE ANALYTICS ====================

// GET /api/admin/analytics/range — Analytics for a date range
router.get('/analytics/range', adminAuth, async (req, res) => {
  const { prisma } = req;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [orders, paidBills, totalOrders] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { items: { include: { menuItem: true } }, table: true }
      }),
      prisma.bill.findMany({
        where: { isPaid: true, createdAt: { gte: start, lte: end } }
      }),
      prisma.order.count({
        where: { createdAt: { gte: start, lte: end } }
      })
    ]);

    const totalRevenue = paidBills.reduce((sum, b) => sum + b.total, 0);
    const avgOrderValue = paidBills.length > 0 ? totalRevenue / paidBills.length : 0;

    // Revenue by category
    const categoryRevenue = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const cat = item.menuItem.category;
        if (!categoryRevenue[cat]) categoryRevenue[cat] = 0;
        categoryRevenue[cat] += item.price * item.quantity;
      });
    });
    const categoryData = Object.entries(categoryRevenue)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    // Top items
    const itemStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.menuItemId;
        if (!itemStats[key]) {
          itemStats[key] = {
            name: item.menuItem.name,
            category: item.menuItem.category,
            count: 0,
            revenue: 0
          };
        }
        itemStats[key].count += item.quantity;
        itemStats[key].revenue += item.price * item.quantity;
      });
    });
    const topItems = Object.values(itemStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(i => ({ ...i, revenue: parseFloat(i.revenue.toFixed(2)) }));

    // Daily breakdown
    const dailyData = {};
    paidBills.forEach(bill => {
      const day = new Date(bill.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (!dailyData[day]) dailyData[day] = { revenue: 0, orders: 0 };
      dailyData[day].revenue += bill.total;
      dailyData[day].orders++;
    });
    const dailyBreakdown = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }));

    // Peak hours
    const hourlyVolume = Array(24).fill(0);
    orders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      hourlyVolume[hour]++;
    });
    const peakHour = hourlyVolume.indexOf(Math.max(...hourlyVolume));

    res.json({
      dateRange: { start: startDate, end: endDate },
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      categoryData,
      topItems,
      dailyBreakdown,
      peakHour: `${peakHour}:00 - ${peakHour + 1}:00`,
      totalBills: paidBills.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/export/range — Export orders for date range
router.get('/export/range', adminAuth, async (req, res) => {
  const { prisma } = req;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }

  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        bill: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const rows = [['Date', 'Order ID', 'Table', 'Item', 'Category', 'Qty', 'Price', 'Item Total', 'Order Status', 'Bill Status', 'Bill Total']];
    orders.forEach(order => {
      order.items.forEach(item => {
        rows.push([
          new Date(order.createdAt).toLocaleDateString('en-IN'),
          order.id,
          `T${order.table.tableNumber}`,
          item.menuItem.name,
          item.menuItem.category,
          item.quantity,
          item.price,
          (item.price * item.quantity).toFixed(2),
          order.status,
          order.bill?.isPaid ? 'Paid' : order.bill ? 'Unpaid' : 'No Bill',
          order.bill?.total || '-'
        ]);
      });
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=escape-orders-${startDate}-to-${endDate}.csv`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// ==================== QR CODE GENERATION ====================

// GET /api/admin/tables/:id/qr — Generate QR code data for a table
router.get('/tables/:id/qr', adminAuth, async (req, res) => {
  const { prisma } = req;
  const id = parseInt(req.params.id);

  try {
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Base URL for scanning - uses current host
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrUrl = `${baseUrl}/menu?table=${table.tableNumber}`;

    res.json({
      tableNumber: table.tableNumber,
      qrUrl,
      qrData: qrUrl // Can be used with QR code library
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR data' });
  }
});

module.exports = router;
