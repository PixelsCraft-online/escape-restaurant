const express = require('express');
const router = express.Router();

// GET /api/menu — Returns all available menu items (DB query directly)
router.get('/', async (req, res) => {
  const { prisma } = req;
  try {
    const items = await prisma.menuItem.findMany({ orderBy: { category: 'asc' } });
    res.json({ source: 'db', items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// GET /api/menu/table/:tableNumber — Verify table and return tableId
router.get('/table/:tableNumber', async (req, res) => {
  const { prisma } = req;
  const tableNumber = parseInt(req.params.tableNumber);
  if (isNaN(tableNumber)) return res.status(400).json({ error: 'Invalid table number' });

  try {
    const table = await prisma.table.findUnique({ where: { tableNumber } });
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json({ tableId: table.id, tableNumber: table.tableNumber, isOccupied: table.isOccupied });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify table' });
  }
});

module.exports = router;
