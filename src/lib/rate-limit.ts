/**
 * A fixed-window rate limiter kept in process memory.
 *
 * Good enough to stop one token or one tool from hammering an instance,
 * which is the abuse case today. It is per instance, so on a horizontally
 * scaled deployment the effective limit is multiplied by the instance
 * count; moving the counters to Postgres or Redis is the upgrade path.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = Date.now();

export const LIMITS = {
  deploy: { max: 20, windowMs: 60_000 },
  toolApi: { max: 300, windowMs: 60_000 },
  connectorQuery: { max: 60, windowMs: 60_000 },
  login: { max: 10, windowMs: 5 * 60_000 },
} as const;

export function rateLimit(
  key: string,
  limit: { max: number; windowMs: number },
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (now - lastSweep > 60_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    lastSweep = now;
  }

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { ok: true };
  }
  if (current.count >= limit.max) {
    return { ok: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { ok: true };
}

export function __resetRateLimits() {
  windows.clear();
}
