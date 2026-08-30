/**
 * Visit lock middleware.
 * 
 * After a visit is completed, it can be corrected within 24 hours.
 * After 24 hours, the record is permanently locked.
 * 
 * This middleware checks if a visit is modifiable.
 */

const LOCK_WINDOW_HOURS = 24;

/**
 * Check if a visit is locked.
 * A visit is locked if:
 *   1. is_locked is explicitly true, OR
 *   2. completed_at was more than 24 hours ago
 */
function isVisitLocked(visit) {
  if (visit.is_locked) return true;
  if (visit.completed_at) {
    const completedAt = new Date(visit.completed_at);
    const now = new Date();
    const hoursSinceCompletion = (now - completedAt) / (1000 * 60 * 60);
    if (hoursSinceCompletion > LOCK_WINDOW_HOURS) {
      return true;
    }
  }
  return false;
}

/**
 * Express middleware: reject modifications to locked visits.
 * Use on PATCH/DELETE routes for visits.
 */
function requireUnlocked(req, res, next) {
  if (req.visit && isVisitLocked(req.visit)) {
    return res.status(400).json({
      error: 'Visit is locked and cannot be modified',
      locked: true,
      completed_at: req.visit.completed_at,
    });
  }
  next();
}

module.exports = { isVisitLocked, requireUnlocked, LOCK_WINDOW_HOURS };
