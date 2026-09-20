import { createHash } from "node:crypto";
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

/**
 * Identifies the caller behind Vercel's proxy, as a hash rather than the
 * address itself — the counter only ever needs to tell callers apart, so there
 * is no reason for a bucket of IP addresses to sit in Redis for an hour.
 *
 * Set RATELIMIT_SALT to make that hash one-way in practice. Without it the
 * whole IPv4 space can simply be hashed and compared, so the salt is what
 * turns this from tidiness into actual minimisation.
 */
export function clientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  const address = (typeof forwarded === "string" && forwarded.trim())
    ? forwarded.split(",")[0].trim()
    : req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "";

  if (!address) return "unknown";
  return createHash("sha256")
    .update(`${process.env.RATELIMIT_SALT ?? ""}:${address}`)
    .digest("base64url")
    .slice(0, 22);
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
