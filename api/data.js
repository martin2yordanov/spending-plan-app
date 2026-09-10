import Redis from "ioredis";
import { applyCors } from "./_cors.js";
import { isClerkUserId, getVerifiedUserId, authConfigured } from "./_auth.js";

// ioredis embeds the whole connection string — password included — in its
// connection error messages ("connect ENOENT redis://default:hunter2@host").
// Those messages otherwise reach both the runtime logs and the HTTP response,
// so scrub any credentials before anything is surfaced.
function redact(message) {
  return String(message ?? "Internal error").replace(/rediss?:\/\/\S*/gi, "redis://[redacted]");
}

let _client = null;
function getClient() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL env var is not set");
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
    // Without a listener ioredis reports connection failures as unhandled
    // 'error' events, which print the raw URL. Commands still reject on their
    // own, so this only replaces that logging with a scrubbed line.
    _client.on("error", (err) => console.error("[api/data] redis:", redact(err?.message)));
  }
  return _client;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const { id } = req.query;
  // Accepts sync codes (e.g. "AB12CD") and Clerk user IDs (e.g. "user_2abc...").
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    return res.status(400).json({ error: "Missing or invalid id" });
  }

  // GET stays open for every id, including sync codes and Clerk ids that
  // are not the caller's own: "Import data from another account" is a
  // deliberate self-service recovery path that reads an arbitrary id by
  // knowledge of it, the same shared-secret model a sync code already relies
  // on before sign-in even exists. Locking that down would break recovery,
  // not just add friction.
  //
  // Writes are different — there is no legitimate reason to overwrite or
  // delete a plan that is not the caller's. A sync code has no session to
  // check (that's inherent to being pre-sign-in), so this only ever
  // authenticates the user_* form.
  //
  // authConfigured() gates this on purpose: until CLERK_SECRET_KEY is set in
  // Vercel, every write to a user_* id would otherwise start failing with
  // 401 the moment this deploys — a self-inflicted outage for the app's own
  // real users. Unconfigured means "no worse than before" (unauthenticated,
  // as it already was); once the key is set, this becomes a hard 401 on any
  // mismatch. The gap is logged so it does not go unnoticed indefinitely.
  if ((req.method === "POST" || req.method === "DELETE") && isClerkUserId(id)) {
    if (!authConfigured()) {
      console.warn("[api/data] CLERK_SECRET_KEY not set — writes are unauthenticated");
    } else {
      const verifiedUserId = await getVerifiedUserId(req);
      if (verifiedUserId !== id) {
        return res.status(401).json({ error: "Sign-in required to modify this account's data" });
      }
    }
  }

  const KEY = `spending-plan:${id}`;

  try {
    const redis = getClient();
    if (req.method === "GET") {
      const raw = await redis.get(KEY);
      return res.status(200).json(raw ? JSON.parse(raw) : null);
    }
    if (req.method === "POST") {
      await redis.set(KEY, JSON.stringify(req.body));
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      // App Store guideline 5.1.1(v): deleting the account has to remove the
      // data too, not just sign the person out. Deleting a key that is already
      // gone returns 0, which is still success from the caller's side.
      const removed = await redis.del(KEY);
      return res.status(200).json({ ok: true, removed });
    }
    res.status(405).end();
  } catch (err) {
    console.error("[api/data]", redact(err?.message ?? err));
    res.status(500).json({ error: redact(err?.message ?? err) });
  }
}
