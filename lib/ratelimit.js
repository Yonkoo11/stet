// Per-instance, in-memory rate limit for the public demo endpoint. Serverless
// instances don't share memory, so this caps abuse per warm instance only; it is
// a speed bump, not a quota. Documented as such in the README.
const WINDOW_MS = 60_000;
const hits = new Map();

// An empty STET_RATE_PER_MIN= line in .env must not become a limit of 0.
export function rateLimited(key, limit = Number(process.env.STET_RATE_PER_MIN) || 10, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function clientKey(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  return (typeof fwd === "string" && fwd.split(",")[0].trim()) || req.socket?.remoteAddress || "unknown";
}
