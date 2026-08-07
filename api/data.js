import Redis from "ioredis";

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
  const { id } = req.query;
  // Accepts sync codes (e.g. "AB12CD") and Clerk user IDs (e.g. "user_2abc...").
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    return res.status(400).json({ error: "Missing or invalid id" });
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
    res.status(405).end();
  } catch (err) {
    console.error("[api/data]", redact(err?.message ?? err));
    res.status(500).json({ error: redact(err?.message ?? err) });
  }
}
