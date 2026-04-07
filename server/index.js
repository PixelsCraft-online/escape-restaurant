require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const tableRoutes = require('./routes/tables');
const { router: tableSessionRoutes } = require('./routes/tableSession');
const registerSocketEvents = require('./socket/orderEvents');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Redis client with reduced retries for dev
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  retryStrategy: () => null, // Don't retry - just fail fast if Redis unavailable
  lazyConnect: true,
});
redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', () => {}); // Silently ignore Redis errors

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Attach prisma, redis, io to request
app.use((req, res, next) => {
  req.prisma = prisma;
  req.redis = redis;
  req.io = io;
  next();
});

// Routes
app.use('/api/menu', menuRoutes);
app.use('/api', orderRoutes);
app.use('/api', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/session', tableSessionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io events
registerSocketEvents(io, prisma, redis);

// Warm up menu cache on startup
async function warmMenuCache() {
  try {
    const cached = await redis.get('menu:all');
    if (!cached) {
      const items = await prisma.menuItem.findMany({ where: { isAvailable: true } });
      await redis.setex('menu:all', 300, JSON.stringify(items));
      console.log('✅ Menu cache warmed');
    } else {
      console.log('✅ Menu already cached');
    }
  } catch (err) {
    console.log('⚠️ Menu cache warm-up skipped:', err.message);
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await warmMenuCache();
});
