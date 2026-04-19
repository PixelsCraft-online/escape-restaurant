const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { tableAuth, optionalTableAuth } = require('../middleware/tableAuth');

// POST /api/orders — Create new order OR add to existing active order (requires valid table token)
router.post('/orders', tableAuth, async (req, res) => {
  const { prisma, io } = req;
  const { items } = req.body;
  const tableId = req.tableId; // From tableAuth middleware

  if (!items || !items.length) {
    return res.status(400).json({ error: 'items are required' });
  }

  try {
    if (items.some(i => i.quantity <= 0 || !Number.isInteger(i.quantity))) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    // Fetch menu items for price validation
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, isAvailable: true } });
    
    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'One or more items are invalid or unavailable' });
    }
    
    const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, m.price]));

    // Check if there's an active order for this table (not BILLED or COMPLETED with bill)
    const existingOrder = await prisma.order.findFirst({
      where: {
        tableId,
        status: { notIn: ['BILLED'] },
        bill: null // No bill generated yet
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    let order;

    if (existingOrder) {
      // Add items to existing order
      await Promise.all(
        items.map((item) =>
          prisma.orderItem.create({
            data: {
              orderId: existingOrder.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: priceMap[item.menuItemId],
              itemStatus: 'PENDING',
              instructions: item.instructions || null,
            },
          })
        )
      );

      // Update order status back to IN_PROGRESS if it was COMPLETED
      order = await prisma.order.update({
        where: { id: existingOrder.id },
        data: { status: existingOrder.status === 'COMPLETED' ? 'IN_PROGRESS' : existingOrder.status },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      });

      // Keep table occupancy in sync even when an old active order is reused.
      await prisma.table.update({ where: { id: tableId }, data: { isOccupied: true } });

      // Emit update event
      io.to('staff').emit('order_updated', order);
      io.to('admin').emit('order_updated', order);
      io.to(`table_${order.table.tableNumber}`).emit('order_updated', order);

    } else {
      // Create new order
      order = await prisma.order.create({
        data: {
          tableId,
          status: 'PENDING',
          items: {
            create: items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: priceMap[item.menuItemId],
              itemStatus: 'PENDING',
              instructions: item.instructions || null,
            })),
          },
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      });

      // Mark table as occupied
      await prisma.table.update({ where: { id: tableId }, data: { isOccupied: true } });

      // Emit new order event
      io.to('staff').emit('new_order', order);
      io.to('admin').emit('new_order', order);
    }

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH /api/orders/:id/items — Add more items to existing order (requires valid table token)
router.patch('/orders/:id/items', tableAuth, async (req, res) => {
  const { prisma, io } = req;
  const orderId = parseInt(req.params.id);
  const { items } = req.body;
  const tableId = req.tableId;

  if (!items || !items.length) return res.status(400).json({ error: 'items required' });

  try {
    // Verify the order belongs to the authenticated table
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true }
    });

    if (!existingOrder || existingOrder.tableId !== tableId) {
      return res.status(403).json({ error: 'Order does not belong to this table' });
    }

    if (items.some(i => i.quantity <= 0 || !Number.isInteger(i.quantity))) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, isAvailable: true } });
    
    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'One or more items are invalid or unavailable' });
    }
    
    const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, m.price]));

    const newItems = await Promise.all(
      items.map((item) =>
        prisma.orderItem.create({
          data: {
            orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: priceMap[item.menuItemId], // strictly use DB price
            itemStatus: 'PENDING',
            instructions: item.instructions || null,
          },
          include: { menuItem: true },
        })
      )
    );

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    // Update order status - if COMPLETED, change back to IN_PROGRESS since new items were added
    if (existingOrder.status === 'COMPLETED') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'IN_PROGRESS' } });
    }

    // Ensure table remains marked occupied while active items are being added.
    await prisma.table.update({ where: { id: tableId }, data: { isOccupied: true } });

    io.to('staff').emit('order_updated', updatedOrder);
    io.to('admin').emit('order_updated', updatedOrder);
    io.to(`table_${existingOrder.table.tableNumber}`).emit('order_updated', updatedOrder);

    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add items' });
  }
});

// PATCH /api/order-items/:id — Update item status
router.patch('/order-items/:id', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);
  const { itemStatus } = req.body;

  const validStatuses = ['PENDING', 'PREPARING', 'DONE', 'OUT_OF_STOCK', 'SKIPPED'];
  if (!validStatuses.includes(itemStatus)) {
    return res.status(400).json({ error: 'Invalid itemStatus' });
  }

  try {
    const orderItem = await prisma.orderItem.update({
      where: { id },
      data: { itemStatus },
      include: { menuItem: true, order: { include: { table: true } } },
    });

    const tableNumber = orderItem.order.table.tableNumber;

    // Broadcast to customer's table room and staff
    io.to(`table_${tableNumber}`).emit('item_status_update', { orderItem });
    io.to('staff').emit('item_status_update', { orderItem });

    // Keep order status in sync with item states
    const allItems = await prisma.orderItem.findMany({ where: { orderId: orderItem.orderId } });
    const terminalStatuses = ['DONE', 'SKIPPED', 'OUT_OF_STOCK'];
    const allFinished = allItems.every((i) => terminalStatuses.includes(i.itemStatus));
    const allDone = allItems.every((i) => i.itemStatus === 'DONE');
    const newStatus = allFinished ? (allDone ? 'COMPLETED' : 'PARTIALLY_READY') : 'IN_PROGRESS';

    const updatedOrder = await prisma.order.update({
      where: { id: orderItem.orderId },
      data: { status: newStatus },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    io.to(`table_${tableNumber}`).emit('order_updated', updatedOrder);
    io.to('staff').emit('order_updated', updatedOrder);
    io.to('admin').emit('order_updated', updatedOrder);

    if (allFinished) {
      // Emit order status change to customer
      io.to(`table_${tableNumber}`).emit('order_completed', updatedOrder);
      io.to('staff').emit('order_completed', updatedOrder);
    }

    res.json(orderItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item status' });
  }
});

// PATCH /api/orders/:id/complete — Mark order as delivered (COMPLETED)
router.patch('/orders/:id/complete', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);

  try {
    const order = await prisma.order.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    io.to('staff').emit('order_completed', order);
    io.to(`table_${order.table.tableNumber}`).emit('order_completed', order);

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

// GET /api/orders — Get all active orders for counter panel
router.get('/orders', adminAuth, async (req, res) => {
  const { prisma } = req;
  try {
    const orders = await prisma.order.findMany({
      where: { status: { not: 'BILLED' } },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/table/:tableId — Get active orders for a specific table (track page)
// Protected by table token - verifies the token matches the requested table
router.get('/orders/table/:tableId', tableAuth, async (req, res) => {
  const { prisma } = req;
  const tableId = parseInt(req.params.tableId);

  // Verify the requested table matches the authenticated session
  if (tableId !== req.tableId) {
    return res.status(403).json({ error: 'Access denied to this table\'s orders' });
  }

  try {
    // Show all active (not billed) orders for this table.
    // This keeps tracking consistent even if a session token is refreshed mid-visit.
    const orders = await prisma.order.findMany({
      where: { 
        tableId, 
        status: { notIn: ['BILLED'] }
      },
      include: { items: { include: { menuItem: true } }, table: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
