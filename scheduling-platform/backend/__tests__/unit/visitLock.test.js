const { isVisitLocked, LOCK_WINDOW_HOURS } = require('../../src/middleware/visitLock');

describe('Visit Lock', () => {
  describe('isVisitLocked', () => {
    test('returns true when visit is explicitly locked', () => {
      const visit = { is_locked: true };
      expect(isVisitLocked(visit)).toBe(true);
    });

    test('returns false when visit is not locked and not completed', () => {
      const visit = { is_locked: false, completed_at: null };
      expect(isVisitLocked(visit)).toBe(false);
    });

    test('returns false when completed within lock window', () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60 * 12); // 12 hours ago
      const visit = { is_locked: false, completed_at: recentTime.toISOString() };
      expect(isVisitLocked(visit)).toBe(false);
    });

    test('returns true when completed beyond lock window', () => {
      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 25); // 25 hours ago
      const visit = { is_locked: false, completed_at: oldTime.toISOString() };
      expect(isVisitLocked(visit)).toBe(true);
    });

    test('returns false when completed_at is exactly at the boundary', () => {
      const boundaryTime = new Date(Date.now() - 1000 * 60 * 60 * LOCK_WINDOW_HOURS);
      const visit = { is_locked: false, completed_at: boundaryTime.toISOString() };
      // Should be false since hours since completion is <= LOCK_WINDOW_HOURS
      expect(isVisitLocked(visit)).toBe(false);
    });

    test('returns false for a brand new visit', () => {
      const visit = { is_locked: false, completed_at: null };
      expect(isVisitLocked(visit)).toBe(false);
    });
  });

  describe('LOCK_WINDOW_HOURS', () => {
    test('is set to 24', () => {
      expect(LOCK_WINDOW_HOURS).toBe(24);
    });
  });
});
