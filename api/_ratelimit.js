import Redis from "ioredis";

// A fixed-window counter in the Redis that already backs the plan store.
// Serverless functions share nothing else, so there is nowhere else to put it.
let _client = null;
function getClient() {
  if (!process.env.REDIS_URL) return null;
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
    // ioredis prints the whole connection string, password included, when an
    // 'error' event has no listener. Commands still reject on their own.
    _client.on("error", () => {});
  }
  return _client;
}

/** Best guess at the caller, behind Vercel's proxy. */
export function clientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

/**
 * Consumes one unit against `key` and reports whether the caller is still
 * within `limit` per `windowSeconds`.
 *
 * Fails OPEN. This guards a spending limit, not anybody's data, so a Redis
 * outage should cost money rather than take a working feature away from every
 * user at once. `degraded` says which of the two happened.
 */
export async function rateLimit(key, { limit, windowSeconds }) {
  const redis = getClient();
  if (!redis) return { allowed: true, remaining: limit, degraded: true };

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const window = Math.floor(nowSeconds / windowSeconds);
    const bucket = `ratelimit:${key}:${window}`;

    const used = await redis.incr(bucket);
    // Only the request that created the bucket needs to set the expiry, and
    // the window is short enough that a lost EXPIRE self-corrects next window.
    if (used === 1) await redis.expire(bucket, windowSeconds);

    if (used > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: (window + 1) * windowSeconds - nowSeconds,
      };
    }
    return { allowed: true, remaining: limit - used };
  } catch {
    return { allowed: true, remaining: limit, degraded: true };
  }
}
