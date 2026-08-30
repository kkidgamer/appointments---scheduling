const express = require('express');
const db = require('../config/database');
const { requireAuth, requireOwner } = require('../middleware/auth');
const { scopedQuery } = require('../middleware/tenant');
const { validate, isRequired } = require('../utils/validation');

const router = express.Router();

// All routes require auth
router.use(requireAuth);

/**
 * GET /api/businesses
 * List all businesses (platform admin only — owner of any business).
 */
router.get('/', requireOwner, async (req, res, next) => {
  try {
    const businesses = await db('businesses')
      .select('id', 'name', 'phone', 'email', 'timezone', 'is_active', 'created_at')
      .orderBy('name');
    res.json({ businesses });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/businesses/:id
 * Get a single business by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const business = await db('businesses')
      .where('id', req.params.id)
      .where('id', req.auth.business_id)
      .select('id', 'name', 'phone', 'email', 'address', 'timezone', 'standard_hours', 'is_active', 'created_at')
      .first();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({ business });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/businesses/:id
 * Update a business (owner only).
 */
router.patch('/:id', requireOwner, async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'email', 'address', 'timezone', 'standard_hours', 'is_active'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.updated_at = new Date();

    const [business] = await db('businesses')
      .where('id', req.params.id)
      .where('id', req.auth.business_id)
      .update(updates)
      .returning('*');

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({ business });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
