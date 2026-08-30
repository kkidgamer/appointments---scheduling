const express = require('express');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');
const { validate, isRequired, isPositiveInt } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

// --- Service Categories ---

/**
 * GET /api/services/categories
 * List all service categories for the business.
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await scopedQuery(req, 'service_categories')
      .select('id', 'name', 'description', 'sort_order')
      .orderBy('sort_order');
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/services/categories
 * Create a service category (admin only).
 */
router.post('/categories', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { name, description, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const [category] = await scopedQuery(req, 'service_categories')
      .insert({ business_id: req.auth.business_id, name, description: description || null, sort_order: sort_order || 0 })
      .returning('*');

    res.status(201).json({ category });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    next(err);
  }
});

/**
 * PATCH /api/services/categories/:id
 * Update a service category (admin only).
 */
router.patch('/categories/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { name, description, sort_order } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [category] = await scopedQuery(req, 'service_categories')
      .where('id', req.params.id)
      .update(updates)
      .returning('*');

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category });
  } catch (err) {
    next(err);
  }
});

// --- Services ---

/**
 * GET /api/services
 * List all services for the business, optionally filtered by category.
 */
router.get('/', async (req, res, next) => {
  try {
    let query = db('services')
      .leftJoin('service_categories', 'service_categories.id', 'services.category_id')
      .where('services.business_id', req.auth.business_id)
      .select(
        'services.id', 'services.name', 'services.description',
        'services.duration_minutes', 'services.is_active',
        'services.open_to_any_provider',
        'services.category_id',
        'service_categories.name as category_name'
      )
      .orderBy('services.name');

    if (req.query.category_id) {
      query = query.where('services.category_id', req.query.category_id);
    }

    const services = await query;
    res.json({ services });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/services/:id
 * Get a single service with its qualifications.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const service = await db('services')
      .leftJoin('service_categories', 'service_categories.id', 'services.category_id')
      .where('services.id', req.params.id)
      .where('services.business_id', req.auth.business_id)
      .select(
        'services.*',
        'service_categories.name as category_name'
      )
      .first();

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Get providers qualified for this service
    if (!service.open_to_any_provider) {
      const providers = await db('provider_services')
        .join('users', 'users.id', 'provider_services.user_id')
        .where('provider_services.service_id', service.id)
        .where('users.is_active', true)
        .select('users.id', 'users.name');
      service.qualified_providers = providers;
    }

    res.json({ service });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/services
 * Create a service (admin only).
 */
router.post('/', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { name, description, duration_minutes, category_id, open_to_any_provider } = req.body;

    const errors = validate(req.body, {
      name: [(v) => isRequired(v, 'Name')],
      duration_minutes: [(v) => isPositiveInt(v, 'Duration')],
    });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const [service] = await scopedQuery(req, 'services')
      .insert({
        business_id: req.auth.business_id,
        name,
        description: description || null,
        duration_minutes: duration_minutes || 30,
        category_id: category_id || null,
        open_to_any_provider: open_to_any_provider !== false,
      })
      .returning('*');

    res.status(201).json({ service });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/services/:id
 * Update a service (admin only).
 */
router.patch('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const allowedFields = ['name', 'description', 'duration_minutes', 'category_id', 'is_active', 'open_to_any_provider'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [service] = await scopedQuery(req, 'services')
      .where('id', req.params.id)
      .update(updates)
      .returning('*');

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ service });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/services/:id
 * Soft-delete a service (admin only).
 */
router.delete('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const [service] = await scopedQuery(req, 'services')
      .where('id', req.params.id)
      .update({ is_active: false, updated_at: new Date() })
      .returning(['id', 'name']);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ message: 'Service deactivated', service });
  } catch (err) {
    next(err);
  }
});

// --- Provider Qualifications for Services ---

/**
 * POST /api/services/:id/qualify-provider
 * Qualify a provider for a service (admin only).
 */
router.post('/:id/qualify-provider', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { provider_id } = req.body;
    if (!provider_id) {
      return res.status(400).json({ error: 'provider_id is required' });
    }

    // Verify the service exists and requires qualification
    const service = await scopedQuery(req, 'services')
      .where('id', req.params.id)
      .first();
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    if (service.open_to_any_provider) {
      return res.status(400).json({ error: 'Service is open to any provider' });
    }

    // Verify the provider exists and is active
    const provider = await scopedQuery(req, 'users')
      .where('id', provider_id)
      .where('is_provider', true)
      .where('is_active', true)
      .first();
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found or inactive' });
    }

    const [qualification] = await db('provider_services')
      .insert({ user_id: provider_id, service_id: req.params.id })
      .returning('*');

    res.status(201).json({ qualification });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Provider already qualified for this service' });
    }
    next(err);
  }
});

/**
 * DELETE /api/services/:id/qualify-provider/:providerId
 * Remove a provider's qualification for a service (admin only).
 */
router.delete('/:id/qualify-provider/:providerId', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const deleted = await db('provider_services')
      .where({ service_id: req.params.id, user_id: req.params.providerId })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: 'Qualification not found' });
    }

    res.json({ message: 'Qualification removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
