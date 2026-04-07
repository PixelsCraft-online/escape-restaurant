const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');

// POST /api/tables/start-session - Create a new session when QR is scanned
router.post('/start-session', async (req, res) => {
  const { prisma } = req;
  const { tableNumber } = req.body;

  if (!tableNumber || typeof tableNumber !== 'number') {
    return res.status(400).json({ error: 'Valid tableNumber is required' });
  }

  try {
    // Verify table exists
    const table = await prisma.table.findUnique({
      where: { tableNumber }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Deactivate any existing active sessions for this table
    await prisma.tableSession.updateMany({
      where: { tableNumber, isActive: true },
      data: { isActive: false }
    });

    // Generate secure token
    const token = crypto.randomUUID();

    // Create session with 4-hour expiry
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const session = await prisma.tableSession.create({
      data: {
        tableNumber,
        token,
        expiresAt,
        isActive: true
      }
    });

    res.status(201).json({
      token: session.token,
      tableNumber: session.tableNumber,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    console.error('Failed to create table session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/tables/validate/:token - Validate a session token
router.get('/validate/:token', async (req, res) => {
  const { prisma } = req;
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ valid: false, error: 'Token required' });
  }

  try {
    const session = await prisma.tableSession.findUnique({
      where: { token }
    });

    if (!session) {
      return res.json({ valid: false, error: 'Invalid token' });
    }

    if (!session.isActive) {
      return res.json({ valid: false, error: 'Session expired' });
    }

    if (new Date() > session.expiresAt) {
      // Mark session as inactive
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      return res.json({ valid: false, error: 'Session expired' });
    }

    // Get table info
    const table = await prisma.table.findUnique({
      where: { tableNumber: session.tableNumber }
    });

    res.json({
      valid: true,
      tableNumber: session.tableNumber,
      tableId: table?.id,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    console.error('Failed to validate token:', err);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

// POST /api/tables/end-session - End a session (admin or when bill is paid)
router.post('/end-session', adminAuth, async (req, res) => {
  const { prisma } = req;
  const { token, tableNumber } = req.body;

  try {
    if (token) {
      await prisma.tableSession.updateMany({
        where: { token },
        data: { isActive: false }
      });
    } else if (tableNumber) {
      await prisma.tableSession.updateMany({
        where: { tableNumber, isActive: true },
        data: { isActive: false }
      });
    } else {
      return res.status(400).json({ error: 'token or tableNumber required' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to end session:', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// GET /api/tables/active-sessions - List all active sessions (admin)
router.get('/active-sessions', adminAuth, async (req, res) => {
  const { prisma } = req;

  try {
    const sessions = await prisma.tableSession.findMany({
      where: { 
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(sessions);
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

module.exports = router;
