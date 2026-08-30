const db = require('../config/database');

/**
 * Extract business_id from the authenticated user.
 * Ensures every request is scoped to a single business tenant.
 */
function getBusinessId(req) {
  if (!req.auth || !req.auth.business_id) {
    return null;
  }
  return req.auth.business_id;
}

/**
 * Check if the business is active (not suspended).
 * Suspended businesses are read-only — this middleware can be
 * selectively applied to write endpoints only.
 */
async function requireActiveBusiness(req, res, next) {
  const businessId = getBusinessId(req);
  if (!businessId) {
    return res.status(403).json({ error: 'No business context' });
  }

  const business = await db('businesses').where('id', businessId).first();
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!business.is_active) {
    return res.status(403).json({ error: 'Business is suspended' });
  }
  next();
}

/**
 * Enforce read-only mode for suspended businesses.
 * Use this on all write endpoints (POST, PUT, PATCH, DELETE).
 */
async function enforceReadOnly(req, res, next) {
  const businessId = getBusinessId(req);
  if (!businessId) {
    return res.status(403).json({ error: 'No business context' });
  }

  const business = await db('businesses').where('id', businessId).first();
  if (!business) {
    return res.status(404).json({ error: 'Business not found' });
  }
  if (!business.is_active) {
    return res.status(403).json({ error: 'Business is suspended — read-only mode' });
  }
  next();
}

/**
 * Create a scoped query builder for the current business.
 * Usage: const rows = await scopedQuery(req, 'users').select('*');
 */
function scopedQuery(req, table) {
  const businessId = getBusinessId(req);
  if (!businessId) {
    throw new Error('No business context — cannot scope query');
  }
  return db(table).where(`${table}.business_id`, businessId);
}

module.exports = { getBusinessId, requireActiveBusiness, enforceReadOnly, scopedQuery };
