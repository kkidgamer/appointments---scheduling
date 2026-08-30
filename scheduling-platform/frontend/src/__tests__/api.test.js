import { describe, it, expect } from 'vitest';
import { api, ApiError } from '../lib/api';

describe('ApiClient', () => {
  it('sets and gets token via localStorage', () => {
    api.setToken('test-token-123');
    expect(api.getToken()).toBe('test-token-123');
    expect(localStorage.getItem('token')).toBe('test-token-123');
  });

  it('removes token when set to null', () => {
    api.setToken('test-token');
    api.setToken(null);
    expect(api.getToken()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('ApiError', () => {
  it('creates error with correct properties', () => {
    const err = new ApiError('Not found', 404, { error: 'not found' });
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.data).toEqual({ error: 'not found' });
    expect(err.name).toBe('ApiError');
  });
});
