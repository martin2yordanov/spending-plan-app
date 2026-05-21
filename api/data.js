import Redis from "ioredis";

let _client = null;
function getClient() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL env var is not set");
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    });
  }
  return _client;
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[A-Z0-9]{4,12}$/.test(id)) {
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
    console.error("[api/data]", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "Internal error" });
  }
}
