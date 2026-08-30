const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery } = require('../middleware/tenant');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/audit
 * List audit log entries (admin only).
 */
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    let query = db('audit_log')
      .leftJoin('users', 'users.id', 'audit_log.user_id')
      .where('audit_log.business_id', req.auth.business_id)
      .select(
        'audit_log.*',
        'users.name as user_name'
      )
      .orderBy('audit_log.created_at', 'desc')
      .limit(200);

    if (req.query.entity_type) {
      query = query.where('audit_log.entity_type', req.query.entity_type);
    }
    if (req.query.action) {
      query = query.where('audit_log.action', req.query.action);
    }

    const entries = await query;
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper: log an audit entry (called from other routes).
 */
async function logAudit(businessId, userId, action, entityType, entityId, oldValues, newValues, notes) {
  return db('audit_log').insert({
    business_id: businessId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues || null,
    new_values: newValues || null,
    notes: notes || null,
  });
}

module.exports = router;
module.exports.logAudit = logAudit;
