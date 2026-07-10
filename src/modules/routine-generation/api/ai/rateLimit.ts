/**
 * Best-effort in-memory IP rate limiter for the AI proxy (design.md §D9).
 *
 * The proxy is unauthenticated (local-first — no accounts) and spends the
 * server's OpenRouter key, so an open endpoint could burn credits. This caps
 * requests per client IP in a fixed window.
 *
 * Deliberately in-memory and PER-INSTANCE: it holds only ephemeral counters
 * (never user data) that vanish on restart, so the "stateless proxy stores
 * nothing durable" constraint still holds. On a multi-instance/serverless
 * deploy it is best-effort, not a hard guarantee — pair it with a platform/edge
 * limit + an OpenRouter key spend cap for real protection (design.md §D9).
 *
 * Server-safe: pure module-level state, no Dexie, no `shared/db`.
 */

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60_000;

function max(): number {
  const raw = Number(process.env.RATE_LIMIT_MAX);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX;
}

function windowMs(): number {
  const raw = Number(process.env.RATE_LIMIT_WINDOW_MS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_WINDOW_MS;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drop expired buckets so the map can't grow unbounded under many unique IPs. */
function sweep(now: number): void {
  if (now - lastSweep < windowMs()) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Record a request for `key` (a client IP) and report whether it is allowed.
 * `now` is injectable for tests.
 */
export function rateLimitOk(key: string, now: number = Date.now()): boolean {
  sweep(now);
  const bucket = buckets.get(key);
  if (bucket === undefined || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs() });
    return true;
  }
  if (bucket.count >= max()) {
    return false;
  }
  bucket.count += 1;
  return true;
}

/** Test-only: clear all counters between cases. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
