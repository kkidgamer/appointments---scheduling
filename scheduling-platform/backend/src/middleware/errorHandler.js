/**
 * Centralized error handler middleware.
 * Logs errors in development, returns clean responses in production.
 */
function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Database constraint violations
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Record already exists' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found' });
  }
  if (err.code === '23P01') {
    // Exclusion constraint violation — scheduling conflict
    return res.status(409).json({ error: 'Scheduling conflict detected' });
  }

  // JWT errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Default
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
