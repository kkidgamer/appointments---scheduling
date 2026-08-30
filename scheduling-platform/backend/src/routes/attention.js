const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/attention
 * List attention items, optionally filtered by severity and status.
 */
router.get('/', async (req, res, next) => {
  try {
    let query = db('attention_items')
      .where('attention_items.business_id', req.auth.business_id);

    if (req.query.severity) {
      query = query.where('attention_items.severity', req.query.severity);
    }
    if (req.query.status) {
      query = query.where('attention_items.status', req.query.status);
    } else {
      // Default: show open items
      query = query.where('attention_items.status', 'open');
    }
    if (req.query.issue_type) {
      query = query.where('attention_items.issue_type', req.query.issue_type);
    }

    // Join for display info
    query = query
      .leftJoin('users as provider', 'provider.id', 'attention_items.provider_id')
      .leftJoin('clients', 'clients.id', 'attention_items.client_id')
      .leftJoin('visits', 'visits.id', 'attention_items.visit_id')
      .select(
        'attention_items.*',
        'provider.name as provider_name',
        'clients.name as client_name',
        'visits.start_time as visit_start_time'
      )
      .orderBy([
        { column: 'attention_items.severity', order: 'asc' }, // urgent first
        { column: 'attention_items.created_at', order: 'desc' },
      ]);

    const items = await query;

    // Auto-recalculate severity based on proximity
    const now = new Date();
    for (const item of items) {
      if (item.visit_start_time && item.status === 'open') {
        const visitTime = new Date(item.visit_start_time);
        const hoursUntil = (visitTime - now) / (1000 * 60 * 60);
        const autoSeverity = hoursUntil <= 48 ? 'urgent' : 'informational';
        if (item.severity !== autoSeverity && item.severity !== req.query._manual_severity) {
          // Auto-update if not manually overridden
          await db('attention_items')
            .where('id', item.id)
            .whereNull('manual_severity_override')
            .update({ severity: autoSeverity });
          item.severity = autoSeverity;
        }
      }
    }

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/attention/counts
 * Get counts by severity and status for dashboard badges.
 */
router.get('/counts', async (req, res, next) => {
  try {
    const counts = await db('attention_items')
      .where('business_id', req.auth.business_id)
      .where('status', 'open')
      .select('severity')
      .count('id as count')
      .groupBy('severity');

    const result = { urgent: 0, informational: 0, total: 0 };
    for (const row of counts) {
      result[row.severity] = parseInt(row.count);
      result.total += parseInt(row.count);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/attention
 * Create an attention item (used internally by conflict detection, etc.).
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      issue_type, title, description, severity,
      visit_id, series_id, provider_id, client_id,
    } = req.body;

    if (!issue_type || !title) {
      return res.status(400).json({ error: 'issue_type and title are required' });
    }

    const [item] = await scopedQuery(req, 'attention_items')
      .insert({
        business_id: req.auth.business_id,
        issue_type,
        title,
        description: description || null,
        severity: severity || 'informational',
        visit_id: visit_id || null,
        series_id: series_id || null,
        provider_id: provider_id || null,
        client_id: client_id || null,
      })
      .returning('*');

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/attention/:id
 * Update severity (manual override) or resolve/dismiss an item.
 */
router.patch('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { severity, status, resolution_notes } = req.body;
    const updates = {};

    if (severity !== undefined) {
      updates.severity = severity;
      updates.manual_severity_override = true;
    }

    if (status !== undefined) {
      const validStatuses = ['open', 'resolved', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }
      updates.status = status;
      if (status === 'resolved' || status === 'dismissed') {
        updates.resolved_by = req.auth.sub;
        updates.resolved_at = new Date();
        updates.resolution_notes = resolution_notes || null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [item] = await scopedQuery(req, 'attention_items')
      .where('id', req.params.id)
      .update(updates)
      .returning('*');

    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
