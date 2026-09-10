import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

// Avoids real JWKS/network calls: a "valid:<sub>" token verifies to that
// subject, anything else throws, same shape as a real bad/expired token would.
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(async (token) => {
    if (typeof token === "string" && token.startsWith("valid:")) {
      return { sub: token.slice("valid:".length) };
    }
    throw new Error("invalid token");
  }),
}));

// api/data.js's getClient() would otherwise try a real Redis connection.
const store = new Map();
vi.mock("ioredis", () => {
  class FakeRedis {
    on() { /* the [error] listener api/data.js attaches — unused here */ }
    async get(key) { return store.has(key) ? store.get(key) : null; }
    async set(key, val) { store.set(key, val); return "OK"; }
    async del(key) { const had = store.has(key); store.delete(key); return had ? 1 : 0; }
  }
  return { default: FakeRedis };
});

process.env.REDIS_URL = "redis://fake-for-tests";

const { isClerkUserId, authConfigured, getVerifiedUserId } = await import("../../api/_auth.js");
const { default: handler } = await import("../../api/data.js");

function fakeReq({ method, id, body, authorization }) {
  return {
    method,
    query: { id },
    headers: authorization ? { authorization } : {},
    body,
  };
}

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.end = () => { res.ended = true; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

describe("isClerkUserId", () => {
  it("matches Clerk's user_ id shape", () => {
    expect(isClerkUserId("user_2abcXYZ789")).toBe(true);
  });
  it("does not match a pre-sign-in sync code", () => {
    expect(isClerkUserId("AB12CD")).toBe(false);
  });
  it("does not match an empty or malformed id", () => {
    expect(isClerkUserId("")).toBe(false);
    expect(isClerkUserId("user_")).toBe(false);
    expect(isClerkUserId("USER_abc")).toBe(false); // case-sensitive, matches Clerk's own casing
  });
});

describe("authConfigured / getVerifiedUserId", () => {
  const ORIGINAL_SECRET = process.env.CLERK_SECRET_KEY;
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = ORIGINAL_SECRET;
  });

  it("reports unconfigured when CLERK_SECRET_KEY is not set", async () => {
    delete process.env.CLERK_SECRET_KEY;
    expect(authConfigured()).toBe(false);
  });

  it("never verifies when unconfigured, even with a token that would otherwise pass", async () => {
    delete process.env.CLERK_SECRET_KEY;
    const req = fakeReq({ method: "POST", id: "x", authorization: "Bearer valid:user_ABC" });
    expect(await getVerifiedUserId(req)).toBeNull();
  });

  it("returns null when there is no Authorization header", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    expect(await getVerifiedUserId(fakeReq({ method: "POST", id: "x" }))).toBeNull();
  });

  it("returns null for a token that fails verification", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    const req = fakeReq({ method: "POST", id: "x", authorization: "Bearer garbage" });
    expect(await getVerifiedUserId(req)).toBeNull();
  });

  it("returns the subject for a token that verifies", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    const req = fakeReq({ method: "POST", id: "x", authorization: "Bearer valid:user_ABC" });
    expect(await getVerifiedUserId(req)).toBe("user_ABC");
  });
});

describe("api/data.js write authorization", () => {
  const ORIGINAL_SECRET = process.env.CLERK_SECRET_KEY;
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = ORIGINAL_SECRET;
  });

  it("allows an unauthenticated write when CLERK_SECRET_KEY is not set (no regression pre-rollout)", async () => {
    delete process.env.CLERK_SECRET_KEY;
    const req = fakeReq({ method: "POST", id: "user_unconfigured", body: { income: [] } });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("rejects a write to a user_* id with no token once configured", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    const req = fakeReq({ method: "POST", id: "user_victim", body: { income: [] } });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    // The write must not have gone through.
    expect(store.get("spending-plan:user_victim")).toBeUndefined();
  });

  it("rejects a write authenticated as a different user", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    const req = fakeReq({
      method: "POST", id: "user_victim", body: { income: [] },
      authorization: "Bearer valid:user_attacker",
    });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(store.get("spending-plan:user_victim")).toBeUndefined();
  });

  it("accepts a write authenticated as the same user", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    const req = fakeReq({
      method: "POST", id: "user_owner", body: { income: [{ id: 1, amount: 5 }] },
      authorization: "Bearer valid:user_owner",
    });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(store.get("spending-plan:user_owner")).income[0].amount).toBe(5);
  });

  it("rejects an unauthenticated DELETE the same way", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    store.set("spending-plan:user_owner2", JSON.stringify({ income: [] }));
    const req = fakeReq({ method: "DELETE", id: "user_owner2" });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    // Still there — the delete must not have happened.
    expect(store.has("spending-plan:user_owner2")).toBe(true);
  });

  it("leaves sync-code ids (pre-sign-in) unauthenticated even when Clerk is configured", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    const req = fakeReq({ method: "POST", id: "AB12CD", body: { income: [] } });
    const res = fakeRes();
    await handler(req, res);
    // A sync code has no session to check by design — this is unrelated to
    // the Clerk-id auth gate and must not be swept up by it.
    expect(res.statusCode).toBe(200);
  });

  it("never gates GET, regardless of whose id it is or whether Clerk is configured", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_fake";
    store.set("spending-plan:user_owner", JSON.stringify({ income: [{ id: 1, amount: 99 }] }));
    const req = fakeReq({ method: "GET", id: "user_owner" }); // no Authorization header at all
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.income[0].amount).toBe(99);
  });
});
