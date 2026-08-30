const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/availability/:providerId
 * Get a provider's weekly availability.
 */
router.get('/:providerId', async (req, res, next) => {
  try {
    const availability = await scopedQuery(req, 'provider_availability')
      .where('user_id', req.params.providerId)
      .orderBy('day_of_week');

    res.json({ availability });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/availability/:providerId
 * Set a provider's full weekly availability (admin only).
 * Replaces the entire schedule.
 */
router.put('/:providerId', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { schedule } = req.body;
    // schedule: [{ day_of_week: 0, start_time: "09:00", end_time: "18:00" }, ...]

    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ error: 'schedule array is required' });
    }

    await db.transaction(async (trx) => {
      // Remove existing
      await trx('provider_availability')
        .where('user_id', req.params.providerId)
        .where('business_id', req.auth.business_id)
        .del();

      // Insert new
      if (schedule.length > 0) {
        const inserts = schedule.map((s) => ({
          user_id: req.params.providerId,
          business_id: req.auth.business_id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          is_active: s.is_active !== false,
        }));
        await trx('provider_availability').insert(inserts);
      }
    });

    const availability = await scopedQuery(req, 'provider_availability')
      .where('user_id', req.params.providerId)
      .orderBy('day_of_week');

    res.json({ availability });
  } catch (err) {
    next(err);
  }
});

// --- Provider Exceptions (day off) ---

/**
 * GET /api/availability/:providerId/exceptions
 * Get a provider's exceptions, optionally filtered by date range.
 */
router.get('/:providerId/exceptions', async (req, res, next) => {
  try {
    let query = scopedQuery(req, 'provider_exceptions')
      .where('user_id', req.params.providerId)
      .orderBy('exception_date', 'desc');

    if (req.query.from) {
      query = query.where('exception_date', '>=', req.query.from);
    }
    if (req.query.to) {
      query = query.where('exception_date', '<=', req.query.to);
    }

    const exceptions = await query;
    res.json({ exceptions });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/availability/:providerId/exceptions
 * Add a provider exception (day off or schedule override).
 */
router.post('/:providerId/exceptions', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { exception_date, is_off, start_time, end_time, notes } = req.body;

    if (!exception_date) {
      return res.status(400).json({ error: 'exception_date is required' });
    }

    const [exception] = await scopedQuery(req, 'provider_exceptions')
      .insert({
        business_id: req.auth.business_id,
        user_id: req.params.providerId,
        exception_date,
        is_off: is_off !== false,
        start_time: start_time || null,
        end_time: end_time || null,
        notes: notes || null,
      })
      .returning('*');

    res.status(201).json({ exception });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Exception already exists for this date' });
    }
    next(err);
  }
});

/**
 * DELETE /api/availability/:providerId/exceptions/:exceptionId
 * Remove a provider exception.
 */
router.delete('/:providerId/exceptions/:exceptionId', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const deleted = await scopedQuery(req, 'provider_exceptions')
      .where('id', req.params.exceptionId)
      .where('user_id', req.params.providerId)
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    res.json({ message: 'Exception removed' });
  } catch (err) {
    next(err);
  }
});

// --- Business Closures ---

/**
 * GET /api/availability/closures
 * List all business closures.
 */
router.get('/closures/list', async (req, res, next) => {
  try {
    let query = scopedQuery(req, 'business_closures').orderBy('closure_date', 'desc');

    if (req.query.from) {
      query = query.where('closure_date', '>=', req.query.from);
    }
    if (req.query.to) {
      query = query.where('closure_date', '<=', req.query.to);
    }

    const closures = await query;
    res.json({ closures });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/availability/closures
 * Add a business closure (admin only).
 */
router.post('/closures', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { closure_date, start_time, end_time, reason } = req.body;

    if (!closure_date) {
      return res.status(400).json({ error: 'closure_date is required' });
    }

    const [closure] = await scopedQuery(req, 'business_closures')
      .insert({
        business_id: req.auth.business_id,
        closure_date,
        start_time: start_time || null,
        end_time: end_time || null,
        reason: reason || null,
      })
      .returning('*');

    res.status(201).json({ closure });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Closure already exists for this date' });
    }
    next(err);
  }
});

/**
 * DELETE /api/availability/closures/:id
 * Remove a business closure (admin only).
 */
router.delete('/closures/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const deleted = await scopedQuery(req, 'business_closures')
      .where('id', req.params.id)
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Closure not found' });
    }

    res.json({ message: 'Closure removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
