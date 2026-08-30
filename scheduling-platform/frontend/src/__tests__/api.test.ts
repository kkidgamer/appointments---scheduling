import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '@/lib/api';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    api.setToken(null);
  });

  describe('Token management', () => {
    it('stores token in localStorage', () => {
      api.setToken('test-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'test-token');
    });

    it('removes token from localStorage', () => {
      api.setToken(null);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });

    it('reads token from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('stored-token');
      const token = api.getToken();
      expect(token).toBe('stored-token');
    });
  });

  describe('Request handling', () => {
    it('makes GET requests with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [] }),
      });

      await api.listUsers();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('includes Authorization header when token is set', async () => {
      api.setToken('my-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [] }),
      });

      await api.listUsers();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('makes POST requests with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token' }),
      });

      await api.login('test@test.com', 'password123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('throws ApiError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      await expect(api.login('test@test.com', 'wrong')).rejects.toThrow(ApiError);
    });

    it('includes status and data in ApiError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      try {
        await api.listUsers();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(404);
        expect((err as ApiError).data).toEqual({ error: 'Not found' });
      }
    });

    it('uses first validation error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ errors: [{ field: 'email', message: 'Invalid email' }] }),
      });

      try {
        await api.register({ business_name: 'Test', name: 'Test', email: 'bad', password: '123' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as ApiError).message).toBe('Invalid email');
      }
    });
  });

  describe('Auth endpoints', () => {
    it('calls login endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'abc', user: {}, business: {} }),
      });

      const result = await api.login('test@test.com', 'pass');
      expect(result.token).toBe('abc');
    });

    it('calls register endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'xyz', user: {}, business: {} }),
      });

      const result = await api.register({
        business_name: 'Salon',
        name: 'Owner',
        email: 'owner@test.com',
        password: 'secure123',
      });
      expect(result.token).toBe('xyz');
    });

    it('calls me endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: '1' }, business: { id: 'b1' } }),
      });

      const result = await api.me();
      expect(result.user.id).toBe('1');
    });
  });

  describe('Resource endpoints', () => {
    it('calls listClients with search param', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ clients: [] }),
      });

      await api.listClients('John');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/clients?search=John',
        expect.anything()
      );
    });

    it('calls listVisits with filter params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ visits: [] }),
      });

      await api.listVisits({ status: 'booked', from: '2024-01-01' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('status=booked');
      expect(url).toContain('from=2024-01-01');
    });
  });
});
