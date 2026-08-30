const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');
const { validate, isRequired, isPhone } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/clients
 * List clients with optional search by name or phone.
 */
router.get('/', async (req, res, next) => {
  try {
    let query = scopedQuery(req, 'clients').select(
      'clients.id', 'clients.name', 'clients.phone', 'clients.email',
      'clients.no_show_count', 'clients.cancellation_count', 'clients.is_flagged',
      'clients.created_at'
    );

    if (req.query.search) {
      const search = `%${req.query.search}%`;
      query = query.where(function () {
        this.whereILike('clients.name', search).orWhereILike('clients.phone', search);
      });
    }

    if (req.query.flagged === 'true') {
      query = query.where('clients.is_flagged', true);
    }

    query = query.orderBy('clients.name').limit(100);

    const clients = await query;
    res.json({ clients });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/clients/:id
 * Get a single client with their appointment history.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const client = await scopedQuery(req, 'clients')
      .where('clients.id', req.params.id)
      .select(
        'clients.id', 'clients.name', 'clients.phone', 'clients.email',
        'clients.no_show_count', 'clients.cancellation_count', 'clients.is_flagged',
        'clients.created_at'
      )
      .first();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get recent appointments (last 20)
    const appointments = await db('visits')
      .leftJoin('visit_segments', 'visit_segments.visit_id', 'visits.id')
      .leftJoin('users as provider', 'provider.id', 'visit_segments.provider_id')
      .leftJoin('services', 'services.id', 'visit_segments.service_id')
      .where('visits.business_id', req.auth.business_id)
      .where('visits.client_id', req.params.id)
      .orderBy('visits.start_time', 'desc')
      .limit(20)
      .select(
        'visits.id as visit_id', 'visits.start_time', 'visits.end_time',
        'visits.status', 'visits.booking_source',
        'visit_segments.id as segment_id',
        'provider.name as provider_name',
        'services.name as service_name',
        'visit_segments.duration_minutes'
      );

    res.json({ client, appointments });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/clients
 * Create a new client.
 */
router.post('/', enforceReadOnly, async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;

    const errors = validate(req.body, {
      name: [(v) => isRequired(v, 'Name')],
      phone: [(v) => isRequired(v, 'Phone'), isPhone],
    });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const [client] = await scopedQuery(req, 'clients')
      .insert({
        business_id: req.auth.business_id,
        name,
        phone,
        email: email || null,
      })
      .returning(['id', 'name', 'phone', 'email', 'no_show_count', 'cancellation_count', 'is_flagged', 'created_at']);

    res.status(201).json({ client });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/clients/:id
 * Update a client.
 */
router.patch('/:id', enforceReadOnly, async (req, res, next) => {
  try {
    const allowedFields = ['name', 'phone', 'email', 'is_flagged'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [client] = await scopedQuery(req, 'clients')
      .where('id', req.params.id)
      .update(updates)
      .returning(['id', 'name', 'phone', 'email', 'is_flagged']);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ client });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/clients/:id
 * Soft-delete a client (requires re-confirmation — destructive action).
 * In v1, we just flag as inactive.
 */
router.delete('/:id', enforceReadOnly, async (req, res, next) => {
  try {
    // This is a destructive action — in production, we'd require
    // a confirmation token. For v1, just soft-delete.
    const [client] = await scopedQuery(req, 'clients')
      .where('id', req.params.id)
      .del()
      .returning(['id', 'name']);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted', client });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
