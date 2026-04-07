// Middleware to validate table session tokens
const tableAuth = async (req, res, next) => {
  const { prisma } = req;
  const token = req.headers['x-table-token'] || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Table session token required' });
  }

  try {
    const session = await prisma.tableSession.findUnique({
      where: { token }
    });

    if (!session || !session.isActive) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (new Date() > session.expiresAt) {
      await prisma.tableSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });
      return res.status(401).json({ error: 'Session expired' });
    }

    // Get table info
    const table = await prisma.table.findUnique({
      where: { tableNumber: session.tableNumber }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Attach table info to request
    req.tableSession = session;
    req.tableNumber = session.tableNumber;
    req.tableId = table.id;

    next();
  } catch (err) {
    console.error('Table auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional table auth - validates token if present, otherwise passes through
const optionalTableAuth = async (req, res, next) => {
  const { prisma } = req;
  const token = req.headers['x-table-token'] || req.query.token;

  if (!token) {
    return next();
  }

  try {
    const session = await prisma.tableSession.findUnique({
      where: { token }
    });

    if (session && session.isActive && new Date() <= session.expiresAt) {
      const table = await prisma.table.findUnique({
        where: { tableNumber: session.tableNumber }
      });

      if (table) {
        req.tableSession = session;
        req.tableNumber = session.tableNumber;
        req.tableId = table.id;
      }
    }

    next();
  } catch (err) {
    console.error('Optional table auth error:', err);
    next();
  }
};

module.exports = { tableAuth, optionalTableAuth };
