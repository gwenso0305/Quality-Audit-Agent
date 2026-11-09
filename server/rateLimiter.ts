/**
 * Sliding window rate limiter for /api/chat and /api/analyze.
 * 30 calls per user per 10 minutes (600,000 ms).
 */

const userCallTimestamps = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CALLS = 30;

export function checkRateLimit(userId: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const timestamps = userCallTimestamps.get(userId) || [];

  // Filter out timestamps older than the window
  const activeTimestamps = timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (activeTimestamps.length >= MAX_CALLS) {
    const oldest = activeTimestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    userCallTimestamps.set(userId, activeTimestamps);
    return { allowed: false, retryAfterSeconds };
  }

  activeTimestamps.push(now);
  userCallTimestamps.set(userId, activeTimestamps);

  // Periodically clean up stale users
  if (userCallTimestamps.size > 1000) {
    for (const [uid, list] of userCallTimestamps.entries()) {
      if (list.every((ts) => now - ts >= WINDOW_MS)) {
        userCallTimestamps.delete(uid);
      }
    }
  }

  return { allowed: true };
}
