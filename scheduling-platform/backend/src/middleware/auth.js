const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';

/**
 * Generate a JWT token for a user.
 */
function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      business_id: user.business_id,
      role: user.role,
      is_provider: user.is_provider,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: require a valid JWT in the Authorization header.
 * Attaches decoded token to req.auth.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    req.auth = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Express middleware: require admin or owner role.
 */
function requireAdmin(req, res, next) {
  if (!req.auth || (req.auth.role !== 'owner' && req.auth.role !== 'admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Express middleware: require owner role.
 */
function requireOwner(req, res, next) {
  if (!req.auth || req.auth.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

module.exports = { generateToken, verifyToken, requireAuth, requireAdmin, requireOwner };
