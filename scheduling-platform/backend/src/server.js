require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/businesses');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const clientRoutes = require('./routes/clients');
const visitRoutes = require('./routes/visits');
const availabilityRoutes = require('./routes/availability');
const seriesRoutes = require('./routes/series');
const attentionRoutes = require('./routes/attention');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// --- Health check ---
app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/attention', attentionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);

// --- 404 handler ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Error handler ---
app.use(errorHandler);

// --- Start server ---
async function start() {
  try {
    // Test database connection
    await db.raw('SELECT 1');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check your DATABASE_URL or DB_* environment variables');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();

module.exports = app;
