const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');
const { validate, isRequired, isEnum, isValidDate } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/visits
 * List visits with filters (date range, provider, status, client).
 */
router.get('/', async (req, res, next) => {
  try {
    let query = db('visits')
      .join('clients', 'clients.id', 'visits.client_id')
      .where('visits.business_id', req.auth.business_id)
      .select(
        'visits.id', 'visits.start_time', 'visits.end_time',
        'visits.status', 'visits.booking_source',
        'visits.notes', 'visits.is_locked', 'visits.created_at',
        'clients.name as client_name', 'clients.phone as client_phone'
      );

    // Date range filter
    if (req.query.from) {
      query = query.where('visits.start_time', '>=', req.query.from);
    }
    if (req.query.to) {
      query = query.where('visits.end_time', '<=', req.query.to);
    }

    // Status filter
    if (req.query.status) {
      query = query.where('visits.status', req.query.status);
    }

    // Client filter
    if (req.query.client_id) {
      query = query.where('visits.client_id', req.query.client_id);
    }

    // Provider filter (if the user is a provider, they only see their own visits)
    if (req.auth.is_provider && req.auth.role === 'staff') {
      query = query.join('visit_segments', 'visit_segments.visit_id', 'visits.id')
        .where('visit_segments.provider_id', req.auth.sub);
    } else if (req.query.provider_id) {
      query = query.join('visit_segments', 'visit_segments.visit_id', 'visits.id')
        .where('visit_segments.provider_id', req.query.provider_id);
    }

    query = query.orderBy('visits.start_time', 'desc').limit(100);

    const visits = await query;

    // Attach segments to each visit
    if (visits.length > 0) {
      const visitIds = visits.map((v) => v.id);
      const segments = await db('visit_segments')
        .join('users as provider', 'provider.id', 'visit_segments.provider_id')
        .join('services', 'services.id', 'visit_segments.service_id')
        .whereIn('visit_segments.visit_id', visitIds)
        .select(
          'visit_segments.id', 'visit_segments.visit_id',
          'visit_segments.provider_id', 'provider.name as provider_name',
          'visit_segments.service_id', 'services.name as service_name',
          'visit_segments.start_time', 'visit_segments.end_time',
          'visit_segments.duration_minutes', 'visit_segments.status'
        );

      const segmentsByVisit = {};
      for (const seg of segments) {
        if (!segmentsByVisit[seg.visit_id]) segmentsByVisit[seg.visit_id] = [];
        segmentsByVisit[seg.visit_id].push(seg);
      }

      for (const visit of visits) {
        visit.segments = segmentsByVisit[visit.id] || [];
      }
    }

    res.json({ visits });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/visits/:id
 * Get a single visit with all segments.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const visit = await db('visits')
      .join('clients', 'clients.id', 'visits.client_id')
      .leftJoin('users as booked_by_user', 'booked_by_user.id', 'visits.booked_by')
      .where('visits.id', req.params.id)
      .where('visits.business_id', req.auth.business_id)
      .select(
        'visits.*',
        'clients.name as client_name', 'clients.phone as client_phone',
        'booked_by_user.name as booked_by_name'
      )
      .first();

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Get segments
    const segments = await db('visit_segments')
      .join('users as provider', 'provider.id', 'visit_segments.provider_id')
      .join('services', 'services.id', 'visit_segments.service_id')
      .where('visit_segments.visit_id', visit.id)
      .select(
        'visit_segments.*',
        'provider.name as provider_name',
        'services.name as service_name'
      )
      .orderBy('visit_segments.start_time');

    visit.segments = segments;

    res.json({ visit });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/visits
 * Create a new visit with segments. The core booking operation.
 * Validates:
 *   - Client exists
 *   - All provider/service combos are valid
 *   - Segments don't conflict with existing bookings (via exclusion constraint)
 *   - Booking source is provided
 */
router.post('/', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { client_id, booking_source, start_time, end_time, notes, segments } = req.body;

    // Validate required fields
    const errors = validate(req.body, {
      client_id: [(v) => isRequired(v, 'Client')],
      booking_source: [(v) => isRequired(v, 'Booking source'), (v) => isEnum(v, ['walk_in', 'whatsapp', 'instagram', 'phone', 'contact_form', 'other'], 'Booking source')],
      start_time: [(v) => isRequired(v, 'Start time'), isValidDate],
      end_time: [(v) => isRequired(v, 'End time'), isValidDate],
    });
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      errors.push({ field: 'segments', message: 'At least one segment is required' });
    }
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Validate visit time window
    const visitStart = new Date(start_time);
    const visitEnd = new Date(end_time);
    if (visitEnd <= visitStart) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Validate client exists
    const client = await scopedQuery(req, 'clients').where('id', client_id).first();
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Validate each segment
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg.provider_id || !seg.service_id || !seg.start_time || !seg.end_time) {
        return res.status(400).json({
          error: `Segment ${i + 1}: provider_id, service_id, start_time, and end_time are required`,
        });
      }

      // Validate provider exists and is active
      const provider = await scopedQuery(req, 'users')
        .where('id', seg.provider_id)
        .where('is_provider', true)
        .where('is_active', true)
        .first();
      if (!provider) {
        return res.status(400).json({ error: `Segment ${i + 1}: Provider not found or inactive` });
      }

      // Validate service exists and is active
      const service = await scopedQuery(req, 'services')
        .where('id', seg.service_id)
        .where('is_active', true)
        .first();
      if (!service) {
        return res.status(400).json({ error: `Segment ${i + 1}: Service not found or inactive` });
      }

      // Validate qualification if service requires it
      if (!service.open_to_any_provider) {
        const qualified = await db('provider_services')
          .where({ user_id: seg.provider_id, service_id: seg.service_id })
          .first();
        if (!qualified) {
          return res.status(400).json({
            error: `Segment ${i + 1}: Provider is not qualified for this service`,
          });
        }
      }
    }

    // Create visit + segments in a transaction
    const result = await db.transaction(async (trx) => {
      const [visit] = await trx('visits')
        .insert({
          business_id: req.auth.business_id,
          client_id,
          booked_by: req.auth.sub,
          booking_source,
          start_time: visitStart,
          end_time: visitEnd,
          notes: notes || null,
        })
        .returning('*');

      const segmentInserts = segments.map((seg) => ({
        visit_id: visit.id,
        business_id: req.auth.business_id,
        provider_id: seg.provider_id,
        service_id: seg.service_id,
        start_time: new Date(seg.start_time),
        end_time: new Date(seg.end_time),
        duration_minutes: seg.duration_minutes || Math.round((new Date(seg.end_time) - new Date(seg.start_time)) / 60000),
        notes: seg.notes || null,
      }));

      const insertedSegments = await trx('visit_segments')
        .insert(segmentInserts)
        .returning('*');

      return { visit, segments: insertedSegments };
    });

    res.status(201).json(result);
  } catch (err) {
    // Exclusion constraint violation = scheduling conflict
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Scheduling conflict — provider is already booked during this time' });
    }
    next(err);
  }
});

/**
 * PATCH /api/visits/:id
 * Update a visit (admin only). Cannot update locked visits.
 */
router.patch('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const visit = await scopedQuery(req, 'visits').where('id', req.params.id).first();
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    if (visit.is_locked) {
      return res.status(400).json({ error: 'Visit is locked and cannot be modified' });
    }

    const allowedFields = ['start_time', 'end_time', 'status', 'notes', 'cancellation_reason'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Track completion time for the 24-hour lock rule
    if (updates.status === 'completed' && !visit.completed_at) {
      updates.completed_at = new Date();
    }

    updates.updated_at = new Date();

    const [updated] = await scopedQuery(req, 'visits')
      .where('id', req.params.id)
      .update(updates)
      .returning('*');

    res.json({ visit: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/visits/:id/status
 * Update visit status (arrived, completed, no_show, cancelled).
 */
router.patch('/:id/status', enforceReadOnly, async (req, res, next) => {
  try {
    const { status, cancellation_reason } = req.body;
    const validStatuses = ['booked', 'arrived', 'completed', 'no_show', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const visit = await scopedQuery(req, 'visits').where('id', req.params.id).first();
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    if (visit.is_locked) {
      return res.status(400).json({ error: 'Visit is locked' });
    }

    const updates = { status, updated_at: new Date() };
    if (status === 'completed') {
      updates.completed_at = new Date();
    }
    if (status === 'cancelled' && cancellation_reason) {
      updates.cancellation_reason = cancellation_reason;
    }

    const [updated] = await scopedQuery(req, 'visits')
      .where('id', req.params.id)
      .update(updates)
      .returning('*');

    // Update client no-show/cancellation counts
    if (status === 'no_show') {
      await db('clients').where('id', visit.client_id).increment('no_show_count', 1);
    } else if (status === 'cancelled') {
      await db('clients').where('id', visit.client_id).increment('cancellation_count', 1);
    }

    res.json({ visit: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
