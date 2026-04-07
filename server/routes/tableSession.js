const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Generate secure token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create a new table session (called when QR is scanned)
router.post('/start', async (req, res) => {
  try {
    const { tableNumber } = req.body;
    
    if (!tableNumber) {
      return res.status(400).json({ error: 'Table number is required' });
    }

    // Check if table exists
    const table = await prisma.table.findUnique({
      where: { tableNumber: parseInt(tableNumber) }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Deactivate any existing sessions for this table
    await prisma.tableSession.updateMany({
      where: { 
        tableNumber: parseInt(tableNumber),
        isActive: true 
      },
      data: { isActive: false }
    });

    // Create new session with 4-hour expiry
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

    const session = await prisma.tableSession.create({
      data: {
        tableNumber: parseInt(tableNumber),
        token,
        expiresAt,
        isActive: true
      }
    });

    res.json({
      token: session.token,
      tableNumber: session.tableNumber,
      tableId: table.id,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Validate a token
router.get('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const session = await prisma.tableSession.findUnique({
      where: { token }
    });

    if (!session) {
      return res.json({ valid: false, error: 'Session not found' });
    }

    if (!session.isActive) {
      return res.json({ valid: false, error: 'Session is no longer active' });
    }

    if (new Date() > session.expiresAt) {
      // Mark as inactive
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      return res.json({ valid: false, error: 'Session has expired' });
    }

    // Get the table ID for API calls
    const table = await prisma.table.findUnique({
      where: { tableNumber: session.tableNumber }
    });

    res.json({
      valid: true,
      tableNumber: session.tableNumber,
      tableId: table?.id || null,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate session' });
  }
});

// End a session (customer done dining)
router.post('/end/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const session = await prisma.tableSession.findUnique({
      where: { token }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.tableSession.update({
      where: { id: session.id },
      data: { isActive: false }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Middleware to validate token (export for use in other routes)
const validateTableToken = async (req, res, next) => {
  const token = req.headers['x-table-token'] || req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Table session token required' });
  }

  try {
    const session = await prisma.tableSession.findUnique({
      where: { token }
    });

    if (!session || !session.isActive || new Date() > session.expiresAt) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Attach table info to request
    req.tableNumber = session.tableNumber;
    req.tableToken = token;
    next();
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Token validation failed' });
  }
};

module.exports = { router, validateTableToken };
