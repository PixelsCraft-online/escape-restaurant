const express = require('express');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const { tableAuth } = require('../middleware/tableAuth');

// POST /api/bills — Generate bill for an order
router.post('/bills', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const { orderId, discount = 0, discountType = 'flat', includeGST = true } = req.body;

  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  try {
    // Check if bill already exists
    const existing = await prisma.bill.findUnique({ where: { orderId } });
    if (existing) return res.json(existing);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } }, table: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Only charge for items that were actually served (exclude OUT_OF_STOCK and SKIPPED)
    const chargeableItems = order.items.filter(
      item => item.itemStatus !== 'OUT_OF_STOCK' && item.itemStatus !== 'SKIPPED'
    );
    
    const subtotal = chargeableItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = (subtotal * discount) / 100;
    } else {
      discountAmount = discount;
    }

    const taxableAmount = subtotal - discountAmount;
    const tax = includeGST ? parseFloat((taxableAmount * 0.05).toFixed(2)) : 0;
    const total = parseFloat((taxableAmount + tax).toFixed(2));

    const bill = await prisma.bill.create({
      data: {
        orderId,
        tableId: order.tableId,
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax,
        discount: parseFloat(discountAmount.toFixed(2)),
        total,
        isPaid: false,
      },
      include: { order: { include: { items: { include: { menuItem: true } }, table: true } } },
    });

    // Update order status to BILLED
    await prisma.order.update({ where: { id: orderId }, data: { status: 'BILLED' } });

    io.to('staff').emit('bill_generated', bill);
    io.to('admin').emit('bill_generated', bill);
    io.to(`table_${order.table.tableNumber}`).emit('bill_generated', bill);

    res.status(201).json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate bill' });
  }
});

// PATCH /api/bills/:id/pay — Mark bill as paid
router.patch('/bills/:id/pay', adminAuth, async (req, res) => {
  const { prisma, io } = req;
  const id = parseInt(req.params.id);

  try {
    const bill = await prisma.bill.update({
      where: { id },
      data: { isPaid: true, paidAt: new Date() },
      include: { order: { include: { table: true } } },
    });

    const tableNumber = bill.order.table.tableNumber;

    // Free up the table
    await prisma.table.update({
      where: { id: bill.tableId },
      data: { isOccupied: false },
    });

    // Deactivate any active sessions for this table
    await prisma.tableSession.updateMany({
      where: { tableNumber, isActive: true },
      data: { isActive: false }
    });

    io.to('staff').emit('bill_paid', bill);
    io.to('admin').emit('bill_paid', bill);
    
    // Notify customer that session has ended
    io.to(`table_${tableNumber}`).emit('bill_paid', bill);
    io.to(`table_${tableNumber}`).emit('session_ended', { 
      tableNumber, 
      message: 'Thank you for dining with us! Your session has ended.' 
    });

    res.json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark bill as paid' });
  }
});

// GET /api/bills — Get all bills (for counter closed tab)
router.get('/bills', adminAuth, async (req, res) => {
  const { prisma } = req;
  const { date, paid } = req.query;
  try {
    const startOfDay = date ? new Date(date) : new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    // If paid param is specified, filter by it; otherwise return all bills
    const whereClause = { 
      createdAt: { gte: startOfDay, lte: endOfDay } 
    };
    if (paid === 'true') whereClause.isPaid = true;
    if (paid === 'false') whereClause.isPaid = false;

    const bills = await prisma.bill.findMany({
      where: whereClause,
      include: {
        order: { include: { items: { include: { menuItem: true } }, table: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bills);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// GET /api/bills/table/:tableId — Get bills for a specific table (protected by table token)
router.get('/bills/table/:tableId', tableAuth, async (req, res) => {
  const { prisma } = req;
  const tableId = parseInt(req.params.tableId);

  // Verify the requested table matches the authenticated session
  if (tableId !== req.tableId) {
    return res.status(403).json({ error: 'Access denied to this table\'s bills' });
  }

  try {
    // Keep unpaid bills visible even if the table session token has been refreshed.
    const sessionStartTime = req.tableSession.createdAt;

    const bills = await prisma.bill.findMany({
      where: { 
        tableId,
        OR: [
          { isPaid: false },
          { createdAt: { gte: sessionStartTime } }
        ]
      },
      include: {
        order: { include: { items: { include: { menuItem: true } }, table: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bills);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

module.exports = router;
