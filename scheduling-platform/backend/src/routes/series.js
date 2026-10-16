const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');

const router = express.Router();

router.use(requireAuth);

/**
 * Generate occurrence dates for a series based on recurrence config.
 */
function generateOccurrences(series, maxCount = 52) {
  const dates = [];
  const start = new Date(series.start_date);
  const endDate = series.end_date ? new Date(series.end_date) : null;
  const max = series.max_occurrences || maxCount;
  const config = typeof series.recurrence_config === 'string'
    ? JSON.parse(series.recurrence_config)
    : series.recurrence_config;

  let current = new Date(start);
  let count = 0;

  while (count < max) {
    if (endDate && current > endDate) break;

    dates.push(new Date(current));
    count++;

    switch (series.recurrence_type) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;

      case 'every_n_weeks':
        current.setDate(current.getDate() + 7 * (config.n || 2));
        break;

      case 'monthly_date':
        current.setMonth(current.getMonth() + 1);
        current.setDate(config.day_of_month || start.getDate());
        break;

      case 'monthly_weekday': {
        // Find the nth weekday of each month
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
        const targetWeekday = config.weekday; // 0=Sun, 6=Sat
        const weekNumber = config.week_number || 1;
        let found = 0;
        for (let d = 1; d <= 31; d++) {
          current.setDate(d);
          if (current.getDay() === targetWeekday) {
            found++;
            if (found === weekNumber) break;
          }
        }
        // If the target weekday doesn't exist this month (e.g., 5th Thursday), skip
        if (found < weekNumber) {
          current.setMonth(current.getMonth() + 1);
        }
        break;
      }

      default:
        current.setDate(current.getDate() + 7);
    }
  }

  return dates;
}

/**
 * POST /api/series
 * Create a recurring visit series with bounded occurrences.
 */
router.post('/', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const {
      client_id, booking_source, recurrence_type, recurrence_config,
      start_date, end_date, max_occurrences, start_time, notes,
      segments,
    } = req.body;

    // Validate
    if (!client_id || !booking_source || !recurrence_type || !recurrence_config || !start_date || !segments?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['weekly', 'every_n_weeks', 'monthly_date', 'monthly_weekday'];
    if (!validTypes.includes(recurrence_type)) {
      return res.status(400).json({ error: `recurrence_type must be one of: ${validTypes.join(', ')}` });
    }

    // Generate occurrence dates
    const seriesData = {
      recurrence_type,
      recurrence_config,
      start_date,
      end_date: end_date || null,
      max_occurrences: max_occurrences || null,
    };
    const dates = generateOccurrences(seriesData, max_occurrences || 52);

    if (dates.length === 0) {
      return res.status(400).json({ error: 'No occurrences would be generated with this config' });
    }

    // All-or-nothing: validate all segments can be booked for ALL dates
    const segmentValidationErrors = [];
    for (const seg of segments) {
      const provider = await scopedQuery(req, 'users')
        .where('id', seg.provider_id).where('is_active', true).first();
      if (!provider) segmentValidationErrors.push(`Provider ${seg.provider_id} not found`);

      const service = await scopedQuery(req, 'services')
        .where('id', seg.service_id).where('is_active', true).first();
      if (!service) segmentValidationErrors.push(`Service ${seg.service_id} not found`);

      if (service && !service.open_to_any_provider) {
        const qualified = await db('provider_services')
          .where({ user_id: seg.provider_id, service_id: seg.service_id }).first();
        if (!qualified) segmentValidationErrors.push(`Provider not qualified for service ${service.name}`);
      }
    }

    if (segmentValidationErrors.length > 0) {
      return res.status(400).json({ errors: segmentValidationErrors });
    }

    // Create series in transaction
    const result = await db.transaction(async (trx) => {
      const [series] = await trx('visit_series')
        .insert({
          business_id: req.auth.business_id,
          client_id,
          booked_by: req.auth.sub,
          booking_source,
          recurrence_type,
          recurrence_config,
          start_date,
          end_date: end_date || null,
          max_occurrences: max_occurrences || null,
        })
        .returning('*');

      // Create version 1 with template
      const [version] = await trx('visit_series_versions')
        .insert({
          series_id: series.id,
          version_number: 1,
          template_segments: segments,
          template_meta: { start_time: start_time || '09:00', notes: notes || '' },
        })
        .returning('*');

      // Create occurrences (without visits yet — visits are generated by rolling horizon)
      const occurrences = dates.map((date, i) => ({
        series_id: series.id,
        series_version_id: version.id,
        occurrence_number: i + 1,
        occurrence_date: date.toISOString().split('T')[0],
        is_exception: false,
      }));

      await trx('visit_series_occurrences').insert(occurrences);

      return { series, version, occurrence_count: occurrences.length };
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/series
 * List all recurring series for the business.
 */
router.get('/', async (req, res, next) => {
  try {
    const series = await db('visit_series')
      .join('clients', 'clients.id', 'visit_series.client_id')
      .where('visit_series.business_id', req.auth.business_id)
      .select(
        'visit_series.*',
        'clients.name as client_name',
        'clients.phone as client_phone'
      )
      .orderBy('visit_series.created_at', 'desc');

    // Attach occurrence counts
    for (const s of series) {
      const counts = await db('visit_series_occurrences')
        .where('series_id', s.id)
        .select(
          db.raw("COUNT(*)::int as total"),
          db.raw("COUNT(resulting_appointment_id) FILTER (WHERE resulting_appointment_id IS NOT NULL)::int as with_visit")
        )
        .first();
      s.occurrence_total = counts.total;
      s.occurrence_with_visit = counts.with_visit;
    }

    res.json({ series });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/series/:id
 * Get a single series with all occurrences.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const series = await db('visit_series')
      .join('clients', 'clients.id', 'visit_series.client_id')
      .where('visit_series.id', req.params.id)
      .where('visit_series.business_id', req.auth.business_id)
      .select('visit_series.*', 'clients.name as client_name')
      .first();

    if (!series) return res.status(404).json({ error: 'Series not found' });

    const occurrences = await db('visit_series_occurrences')
      .leftJoin('visits', 'visits.id', 'visit_series_occurrences.resulting_appointment_id')
      .where('visit_series_occurrences.series_id', series.id)
      .select(
        'visit_series_occurrences.*',
        'visits.status as visit_status',
        'visits.start_time as visit_start_time'
      )
      .orderBy('visit_series_occurrences.occurrence_number');

    const versions = await db('visit_series_versions')
      .where('series_id', series.id)
      .orderBy('version_number');

    res.json({ series, occurrences, versions });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/series/:id
 * Update a series (active/inactive, end date).
 */
router.patch('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { is_active, end_date } = req.body;
    const updates = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (end_date !== undefined) updates.end_date = end_date;
    updates.updated_at = new Date();

    const [series] = await scopedQuery(req, 'visit_series')
      .where('id', req.params.id)
      .update(updates)
      .returning('*');

    if (!series) return res.status(404).json({ error: 'Series not found' });
    res.json({ series });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/series/:id/edit-future
 * Edit "this and all future" occurrences — creates a new version.
 */
router.patch('/:id/edit-future', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { occurrence_number, new_segments, new_meta } = req.body;
    if (!occurrence_number || !new_segments) {
      return res.status(400).json({ error: 'occurrence_number and new_segments are required' });
    }

    const series = await scopedQuery(req, 'visit_series').where('id', req.params.id).first();
    if (!series) return res.status(404).json({ error: 'Series not found' });

    // Get current max version
    const lastVersion = await db('visit_series_versions')
      .where('series_id', series.id)
      .orderBy('version_number', 'desc')
      .first();

    const newVersionNumber = (lastVersion?.version_number || 0) + 1;

    const result = await db.transaction(async (trx) => {
      // Create new version
      const [version] = await trx('visit_series_versions')
        .insert({
          series_id: series.id,
          version_number: newVersionNumber,
          template_segments: new_segments,
          template_meta: new_meta || lastVersion?.template_meta || {},
        })
        .returning('*');

      // Update future occurrences to use new version
      await trx('visit_series_occurrences')
        .where('series_id', series.id)
        .where('occurrence_number', '>=', occurrence_number)
        .whereNull('resulting_appointment_id') // Only unbooked occurrences
        .update({ series_version_id: version.id });

      return { version, new_version_number: newVersionNumber };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/series/:id/exception
 * Mark an occurrence as an exception (provider/service change for one occurrence).
 */
router.post('/:id/exception', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { occurrence_number, exception_data } = req.body;
    if (!occurrence_number || !exception_data) {
      return res.status(400).json({ error: 'occurrence_number and exception_data required' });
    }

    const [occurrence] = await db('visit_series_occurrences')
      .where('series_id', req.params.id)
      .where('occurrence_number', occurrence_number)
      .update({
        is_exception: true,
        exception_data: exception_data,
        updated_at: new Date(),
      })
      .returning('*');

    if (!occurrence) return res.status(404).json({ error: 'Occurrence not found' });
    res.json({ occurrence });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
