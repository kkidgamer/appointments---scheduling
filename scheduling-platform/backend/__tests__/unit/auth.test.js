// Set env BEFORE loading auth module so it picks up the test secret
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';

const { generateToken, verifyToken } = require('../../src/middleware/auth');
const jwt = require('jsonwebtoken');

describe('Auth Middleware', () => {
  const mockUser = {
    id: 'user-123',
    business_id: 'business-456',
    role: 'admin',
    is_provider: true,
  };

  describe('generateToken', () => {
    test('returns a valid JWT string', () => {
      const token = generateToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('token contains correct payload', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.business_id).toBe(mockUser.business_id);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.is_provider).toBe(mockUser.is_provider);
    });

    test('token has an expiry', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('verifyToken', () => {
    test('verifies a valid token', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);
      expect(decoded.sub).toBe(mockUser.id);
      expect(decoded.business_id).toBe(mockUser.business_id);
    });

    test('throws on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    test('throws on tampered token', () => {
      const token = generateToken(mockUser);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyToken(tampered)).toThrow();
    });

    test('throws on token signed with wrong secret', () => {
      const wrongToken = jwt.sign(
        { sub: 'user-123' },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      expect(() => verifyToken(wrongToken)).toThrow();
    });
  });

  describe('requireAuth middleware', () => {
    let requireAuth;

    beforeAll(() => {
      requireAuth = require('../../src/middleware/auth').requireAuth;
    });

    test('calls next() with valid token', () => {
      const token = generateToken(mockUser);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.auth).toBeDefined();
      expect(req.auth.sub).toBe(mockUser.id);
    });

    test('returns 401 without authorization header', () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    test('returns 401 with expired token', () => {
      // Sign with the same secret the auth module uses
      const expiredToken = jwt.sign(
        { sub: 'user-123', business_id: 'b-1', role: 'admin', is_provider: false, exp: Math.floor(Date.now() / 1000) - 60 },
        'test-secret-key-for-unit-tests'
      );
      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      // jwt.verify throws TokenExpiredError for expired tokens
      expect(res.json).toHaveBeenCalledWith({ error: 'Session expired' });
    });
  });

  describe('requireAdmin middleware', () => {
    let requireAdmin;

    beforeAll(() => {
      requireAdmin = require('../../src/middleware/auth').requireAdmin;
    });

    test('calls next() for admin role', () => {
      const req = { auth: { role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('calls next() for owner role', () => {
      const req = { auth: { role: 'owner' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('returns 403 for staff role', () => {
      const req = { auth: { role: 'staff' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
    });

    test('returns 403 without auth', () => {
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireOwner middleware', () => {
    let requireOwner;

    beforeAll(() => {
      requireOwner = require('../../src/middleware/auth').requireOwner;
    });

    test('calls next() for owner role', () => {
      const req = { auth: { role: 'owner' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireOwner(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('returns 403 for admin role', () => {
      const req = { auth: { role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireOwner(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Owner access required' });
    });

    test('returns 403 for staff role', () => {
      const req = { auth: { role: 'staff' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireOwner(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
