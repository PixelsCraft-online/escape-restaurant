require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
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
  max: 500, // Keep protection for public traffic without throttling normal panel usage
  standardHeaders: true, 
  legacyHeaders: false, 
  skip: (req) => {
    const adminPin = req.headers['x-admin-pin'];
    const tableToken = req.headers['x-table-token'];

    // Do not rate limit authenticated admin or table-session requests.
    return Boolean(adminPin || tableToken);
  },
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Attach prisma, io to request
app.use((req, res, next) => {
  req.prisma = prisma;
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
registerSocketEvents(io, prisma);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
