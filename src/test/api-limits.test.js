import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@clerk/backend", () => ({ verifyToken: vi.fn(async () => { throw new Error("no"); }) }));

// One fake Redis behind both api/data.js and api/_ratelimit.js.
const store = new Map();
const counters = new Map();
let redisBroken = false;
vi.mock("ioredis", () => {
  class FakeRedis {
    on() {}
    async get(key) { if (redisBroken) throw new Error("down"); return store.has(key) ? store.get(key) : null; }
    async set(key, val) { if (redisBroken) throw new Error("down"); store.set(key, val); return "OK"; }
    async del(key) { const had = store.has(key); store.delete(key); return had ? 1 : 0; }
    async incr(key) {
      if (redisBroken) throw new Error("down");
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }
    async expire() { return 1; }
  }
  return { default: FakeRedis };
});

process.env.REDIS_URL = "redis://fake-for-tests";
process.env.GROQ_API_KEY = "gsk_fake";

const { rateLimit, clientKey } = await import("../../api/_ratelimit.js");
const { default: dataHandler } = await import("../../api/data.js");
const { default: suggestionsHandler } = await import("../../api/suggestions.js");

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.body = o; return res; };
  res.end = () => { res.ended = true; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

beforeEach(() => { counters.clear(); store.clear(); redisBroken = false; });
afterEach(() => vi.restoreAllMocks());

describe("rateLimit", () => {
  it("allows up to the limit and refuses past it", async () => {
    const opts = { limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit("k", opts)).allowed).toBe(true);
    }
    const over = await rateLimit("k", opts);
    expect(over.allowed).toBe(false);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it("counts each caller separately", async () => {
    const opts = { limit: 1, windowSeconds: 60 };
    expect((await rateLimit("a", opts)).allowed).toBe(true);
    expect((await rateLimit("b", opts)).allowed).toBe(true);
  });

  // This protects a spending limit, not anyone's data. A Redis outage should
  // cost money rather than take a working feature away from every user.
  it("fails open when Redis is unreachable", async () => {
    redisBroken = true;
    const res = await rateLimit("k", { limit: 1, windowSeconds: 60 });
    expect(res.allowed).toBe(true);
    expect(res.degraded).toBe(true);
  });

  it("reads the caller through Vercel's proxy header", () => {
    const first = clientKey({ headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(first).toBe(clientKey({ headers: { "x-forwarded-for": "1.2.3.4" } }));
    expect(first).not.toBe(clientKey({ headers: { "x-forwarded-for": "1.2.3.5" } }));
  });

  // The counter only needs to tell callers apart, so there is no reason for a
  // bucket of IP addresses to sit in Redis for an hour.
  it("does not keep the address itself", () => {
    const key = clientKey({ headers: { "x-forwarded-for": "203.0.113.9" } });
    expect(key).not.toContain("203.0.113.9");
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("falls back to a constant when there is no address at all", () => {
    expect(clientKey({ headers: {} })).toBe("unknown");
  });
});

describe("api/suggestions.js", () => {
  const req = (overrides = {}) => ({
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9" },
    body: { income: [], expenses: [] },
    ...overrides,
  });

  it("refuses once a caller is over its hourly budget", async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "hi" } }] }) }));
    let last;
    for (let i = 0; i < 21; i++) {
      last = fakeRes();
      await suggestionsHandler(req(), last);
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers["Retry-After"]).toBeTruthy();
    // 20 allowed, the 21st refused — and refused without calling Groq.
    expect(global.fetch).toHaveBeenCalledTimes(20);
  });

  // Without a ceiling one request turns into a six-figure token bill.
  it("caps how much of a posted plan reaches the prompt", async () => {
    let sent = "";
    global.fetch = vi.fn(async (_url, opts) => {
      sent = JSON.parse(opts.body).messages[1].content;
      return { ok: true, json: async () => ({ choices: [{ message: { content: "hi" } }] }) };
    });
    const expenses = Array.from({ length: 5000 }, (_, i) => ({
      id: i, name: "x".repeat(5000), category: "Bills", amount: 1, frequency: "Monthly",
    }));
    await suggestionsHandler(req({ body: { income: [], expenses } }), fakeRes());
    expect(sent.length).toBeLessThan(120000);
  });
});

describe("api/data.js payload ceiling", () => {
  it("refuses a plan far larger than any real one", async () => {
    const res = fakeRes();
    await dataHandler(
      { method: "POST", query: { id: "AB12CD" }, headers: {}, body: { blob: "x".repeat(600 * 1024) } },
      res,
    );
    expect(res.statusCode).toBe(413);
    expect(store.has("spending-plan:AB12CD")).toBe(false);
  });

  it("still accepts an ordinary plan", async () => {
    const res = fakeRes();
    await dataHandler(
      { method: "POST", query: { id: "AB12CD" }, headers: {}, body: { income: [{ id: 1, amount: 3000 }] } },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(store.has("spending-plan:AB12CD")).toBe(true);
  });
});

describe("api/data.js rate limiting", () => {
  const get = (ip = "5.5.5.5") => ({ method: "GET", query: { id: "AB12CD" }, headers: { "x-forwarded-for": ip } });

  // A sync code is a six-character secret. A ceiling does not make guessing
  // every value impossible, it makes it impractical from one source.
  it("refuses a caller grinding through ids", async () => {
    let last;
    for (let i = 0; i < 201; i++) {
      last = fakeRes();
      await dataHandler(get(), last);
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers["Retry-After"]).toBeTruthy();
  });

  it("counts each caller separately", async () => {
    for (let i = 0; i < 201; i++) await dataHandler(get("1.1.1.1"), fakeRes());
    const other = fakeRes();
    await dataHandler(get("2.2.2.2"), other);
    expect(other.statusCode).toBe(200);
  });

  // Saves are debounced to one per 2s of editing, so a long session is tens of
  // writes. A refused save surfaces as "Couldn't save" to somebody who did
  // nothing wrong, so reads and writes are budgeted apart.
  it("does not let reads eat into the write budget", async () => {
    for (let i = 0; i < 201; i++) await dataHandler(get("3.3.3.3"), fakeRes());
    const write = fakeRes();
    await dataHandler(
      { method: "POST", query: { id: "AB12CD" }, headers: { "x-forwarded-for": "3.3.3.3" }, body: { income: [] } },
      write,
    );
    expect(write.statusCode).toBe(200);
  });

  it("serves normally when Redis is unreachable", async () => {
    redisBroken = true;
    const res = fakeRes();
    await dataHandler(get("4.4.4.4"), res);
    // The read itself fails on the broken store, but not with a 429 — the
    // limiter must not be what takes the endpoint down.
    expect(res.statusCode).not.toBe(429);
  });
});
