/**
 * Integration tests for /api/auth routes.
 * Tests registration, login, and /me endpoint.
 */
const request = require('supertest');
const { resetStores, createMockDb } = require('./setup');

// Mock the database module before loading the app
let mockDb;
beforeEach(() => {
  resetStores();
  mockDb = createMockDb();

  // Replace the database module with our mock
  jest.resetModules();
  jest.mock('../../src/config/database', () => mockDb);

  // Suppress console.log during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function getApp() {
  return require('../../src/server');
}

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    test('registers a new business owner successfully', async () => {
      const app = getApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          business_name: 'Test Salon',
          name: 'John Owner',
          email: 'john@test.com',
          password: 'secure12345',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe('John Owner');
      expect(res.body.user.email).toBe('john@test.com');
      expect(res.body.user.role).toBe('owner');
      expect(res.body.business.name).toBe('Test Salon');
    });

    test('returns 400 for missing required fields', async () => {
      const app = getApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'John' }); // missing business_name, email, password

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    test('returns 400 for short password', async () => {
      const app = getApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          business_name: 'Test Salon',
          name: 'John',
          email: 'john@test.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8 characters');
    });

    test('returns 400 for invalid email', async () => {
      const app = getApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          business_name: 'Test Salon',
          name: 'John',
          email: 'not-an-email',
          password: 'secure12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some((e) => e.field === 'email')).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    test('returns 401 for non-existent email', async () => {
      const app = getApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@test.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
    });

    test('returns 400 for missing email', async () => {
      const app = getApp();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns 401 without token', async () => {
      const app = getApp();
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    test('returns 401 with invalid token', async () => {
      const app = getApp();
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
