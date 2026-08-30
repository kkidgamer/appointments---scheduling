const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery } = require('../middleware/tenant');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/reports/dashboard
 * Admin dashboard summary: today's stats, this week's numbers.
 */
router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const businessId = req.auth.business_id;
    const now = new Date();

    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // This week (Monday to Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Today's stats
    const todayStats = await db('visits')
      .where('business_id', businessId)
      .whereBetween('start_time', [todayStart, todayEnd])
      .select('status')
      .count('id as count')
      .groupBy('status');

    const todayCounts = { booked: 0, arrived: 0, completed: 0, no_show: 0, cancelled: 0 };
    for (const row of todayStats) {
      todayCounts[row.status] = parseInt(row.count);
    }

    // This week's stats
    const weekStats = await db('visits')
      .where('business_id', businessId)
      .whereBetween('start_time', [weekStart, weekEnd])
      .select('status')
      .count('id as count')
      .groupBy('status');

    const weekCounts = { total: 0, completed: 0, no_show: 0, cancelled: 0 };
    for (const row of weekStats) {
      weekCounts.total += parseInt(row.count);
      if (row.status === 'completed') weekCounts.completed = parseInt(row.count);
      if (row.status === 'no_show') weekCounts.no_show = parseInt(row.count);
      if (row.status === 'cancelled') weekCounts.cancelled = parseInt(row.count);
    }

    // Client count
    const clientCount = await db('clients')
      .where('business_id', businessId)
      .count('id as count')
      .first();

    // Provider count
    const providerCount = await db('users')
      .where('business_id', businessId)
      .where('is_provider', true)
      .where('is_active', true)
      .count('id as count')
      .first();

    // Attention items
    const attentionCounts = await db('attention_items')
      .where('business_id', businessId)
      .where('status', 'open')
      .select('severity')
      .count('id as count')
      .groupBy('severity');

    const attention = { urgent: 0, informational: 0 };
    for (const row of attentionCounts) {
      attention[row.severity] = parseInt(row.count);
    }

    // Today's upcoming visits
    const upcomingVisits = await db('visits')
      .join('clients', 'clients.id', 'visits.client_id')
      .where('visits.business_id', businessId)
      .where('visits.start_time', '>=', now)
      .where('visits.status', 'in', ['booked', 'arrived'])
      .orderBy('visits.start_time')
      .limit(10)
      .select(
        'visits.id', 'visits.start_time', 'visits.end_time', 'visits.status',
        'clients.name as client_name'
      );

    res.json({
      today: todayCounts,
      week: weekCounts,
      clients: parseInt(clientCount.count),
      providers: parseInt(providerCount.count),
      attention,
      upcoming_visits: upcomingVisits,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/providers
 * Provider performance: visits completed, no-shows, etc.
 */
router.get('/providers', requireAdmin, async (req, res, next) => {
  try {
    const businessId = req.auth.business_id;
    const { from, to } = req.query;

    let query = db('visit_segments')
      .join('users', 'users.id', 'visit_segments.provider_id')
      .join('visits', 'visits.id', 'visit_segments.visit_id')
      .where('visit_segments.business_id', businessId)
      .where('users.is_provider', true);

    if (from) query = query.where('visit_segments.start_time', '>=', from);
    if (to) query = query.where('visit_segments.end_time', '<=', to);

    const stats = await query
      .select(
        'users.id',
        'users.name',
        db.raw('COUNT(DISTINCT visit_segments.id)::int as segments_count'),
        db.raw("COUNT(DISTINCT visit_segments.id) FILTER (WHERE visits.status = 'completed')::int as completed"),
        db.raw("COUNT(DISTINCT visit_segments.id) FILTER (WHERE visits.status = 'no_show')::int as no_shows"),
        db.raw("COUNT(DISTINCT visit_segments.id) FILTER (WHERE visits.status = 'cancelled')::int as cancelled"),
        db.raw('SUM(visit_segments.duration_minutes)::int as total_minutes')
      )
      .groupBy('users.id', 'users.name');

    res.json({ providers: stats });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reports/booking-sources
 * Booking source breakdown.
 */
router.get('/booking-sources', requireAdmin, async (req, res, next) => {
  try {
    const businessId = req.auth.business_id;
    const { from, to } = req.query;

    let query = db('visits')
      .where('business_id', businessId);

    if (from) query = query.where('start_time', '>=', from);
    if (to) query = query.where('start_time', '<=', to);

    const sources = await query
      .select('booking_source')
      .count('id as count')
      .groupBy('booking_source');

    res.json({ sources });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
