const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, requireAuth } = require('../middleware/auth');
const { validate, isRequired, isEmail } = require('../utils/validation');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new business owner (admin provisions businesses,
 * but this creates the first owner account for a new business).
 */
router.post('/register', async (req, res, next) => {
  try {
    const { business_name, name, email, password, phone, timezone } = req.body;

    const errors = validate(req.body, {
      business_name: [(v) => isRequired(v, 'Business name')],
      name: [(v) => isRequired(v, 'Name')],
      email: [(v) => isRequired(v, 'Email'), isEmail],
      password: [(v) => isRequired(v, 'Password')],
    });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if email is already taken within any business
    const existing = await db('users').where('email', email.toLowerCase()).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Create business + owner user in a transaction
    const result = await db.transaction(async (trx) => {
      const [business] = await trx('businesses')
        .insert({
          name: business_name,
          timezone: timezone || 'UTC',
        })
        .returning('*');

      const [user] = await trx('users')
        .insert({
          business_id: business.id,
          name,
          email: email.toLowerCase(),
          password_hash,
          phone: phone || null,
          role: 'owner',
          is_provider: false,
        })
        .returning('*');

      return { business, user };
    });

    const token = generateToken(result.user);

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        is_provider: result.user.is_provider,
      },
      business: {
        id: result.business.id,
        name: result.business.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Login with email + password. Business-scoped: same email could exist
 * in different businesses (but in practice it won't since this is
 * provisioned manually). We just grab the first match.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const errors = validate(req.body, {
      email: [(v) => isRequired(v, 'Email'), isEmail],
      password: [(v) => isRequired(v, 'Password')],
    });
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const user = await db('users')
      .join('businesses', 'businesses.id', 'users.business_id')
      .where('users.email', email.toLowerCase())
      .where('users.is_active', true)
      .select('users.*', 'businesses.name as business_name', 'businesses.is_active as business_active')
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.business_active) {
      return res.status(403).json({ error: 'Business is suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_provider: user.is_provider,
      },
      business: {
        id: user.business_id,
        name: user.business_name,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Return the current authenticated user's profile.
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users')
      .join('businesses', 'businesses.id', 'users.business_id')
      .where('users.id', req.auth.sub)
      .select(
        'users.id', 'users.name', 'users.email', 'users.phone',
        'users.role', 'users.is_provider', 'users.is_active',
        'businesses.id as business_id', 'businesses.name as business_name',
        'businesses.is_active as business_active'
      )
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_provider: user.is_provider,
        is_active: user.is_active,
      },
      business: {
        id: user.business_id,
        name: user.business_name,
        is_active: user.business_active,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
