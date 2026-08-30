const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { scopedQuery, enforceReadOnly } = require('../middleware/tenant');
const { validate, isRequired, isEmail, isEnum } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/users
 * List all users in the business.
 */
router.get('/', async (req, res, next) => {
  try {
    const users = await scopedQuery(req, 'users')
      .select('id', 'name', 'email', 'phone', 'role', 'is_provider', 'is_active', 'created_at')
      .orderBy('name');
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Get a single user by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const user = await scopedQuery(req, 'users')
      .where('users.id', req.params.id)
      .select('id', 'name', 'email', 'phone', 'role', 'is_provider', 'is_active', 'created_at')
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user is a provider, also return their qualifications
    if (user.is_provider) {
      const qualifications = await db('provider_services')
        .join('services', 'services.id', 'provider_services.service_id')
        .where('provider_services.user_id', user.id)
        .select('services.id', 'services.name');
      user.qualifications = qualifications;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users
 * Create a new user (admin only).
 */
router.post('/', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const { name, email, password, phone, role, is_provider } = req.body;

    const errors = validate(req.body, {
      name: [(v) => isRequired(v, 'Name')],
      email: [(v) => isRequired(v, 'Email'), isEmail],
      password: [(v) => isRequired(v, 'Password')],
      role: [(v) => isEnum(v, ['owner', 'admin', 'staff'], 'Role')],
    });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check uniqueness within business
    const existing = await scopedQuery(req, 'users')
      .where('email', email.toLowerCase())
      .first();
    if (existing) {
      return res.status(409).json({ error: 'Email already exists in this business' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [user] = await scopedQuery(req, 'users')
      .insert({
        business_id: req.auth.business_id,
        name,
        email: email.toLowerCase(),
        password_hash,
        phone: phone || null,
        role: role || 'staff',
        is_provider: is_provider || false,
      })
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_provider', 'is_active', 'created_at']);

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id
 * Update a user (admin only). Cannot change password here.
 */
router.patch('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    const allowedFields = ['name', 'email', 'phone', 'role', 'is_provider', 'is_active'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      // Check uniqueness
      const existing = await scopedQuery(req, 'users')
        .where('email', updates.email)
        .whereNot('id', req.params.id)
        .first();
      if (existing) {
        return res.status(409).json({ error: 'Email already exists in this business' });
      }
    }

    updates.updated_at = new Date();

    const [user] = await scopedQuery(req, 'users')
      .where('id', req.params.id)
      .update(updates)
      .returning(['id', 'name', 'email', 'phone', 'role', 'is_provider', 'is_active']);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/:id
 * Soft-delete a user (admin only). Requires re-confirmation.
 */
router.delete('/:id', requireAdmin, enforceReadOnly, async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.auth.sub) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [user] = await scopedQuery(req, 'users')
      .where('id', req.params.id)
      .update({ is_active: false, updated_at: new Date() })
      .returning(['id', 'name', 'email']);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated', user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/:id/password
 * Change a user's password (admin or self).
 */
router.patch('/:id/password', enforceReadOnly, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Only admin or the user themselves can change password
    const isAdmin = req.auth.role === 'owner' || req.auth.role === 'admin';
    const isSelf = req.params.id === req.auth.sub;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Not authorized to change this password' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await scopedQuery(req, 'users')
      .where('id', req.params.id)
      .update({ password_hash, updated_at: new Date() })
      .returning(['id', 'email']);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
