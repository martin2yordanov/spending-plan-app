import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The local dev server. Registering its routes is the part that used to throw:
// Express 5's path-to-regexp rejects a bare "*" at registration time, so
// `npm start` did not fail a request, it failed to start.
describe("local dev server", () => {
  let server;
  let base;

  beforeAll(async () => {
    const { createApp } = await import("../../server.js");
    server = createApp({ serveStatic: false }).listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    rmSync(join(root, "data"), { recursive: true, force: true });
  });

  it("starts at all", () => {
    expect(server.listening).toBe(true);
  });

  it("round-trips a plan", async () => {
    const plan = { income: [{ id: 1, name: "Salary", amount: 3000, frequency: "Monthly" }] };
    const put = await fetch(`${base}/api/data?id=TEST01`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    });
    expect(put.status).toBe(200);
    const got = await (await fetch(`${base}/api/data?id=TEST01`)).json();
    expect(got.income[0].amount).toBe(3000);
  });

  it("answers for an id it has never seen", async () => {
    const res = await fetch(`${base}/api/data?id=NOSUCH`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  // Guideline 5.1.1(v)'s in-app account deletion is the one flow App Review
  // specifically checks, and it had no route here at all.
  it("deletes a plan", async () => {
    await fetch(`${base}/api/data?id=TEST02`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ income: [] }),
    });
    const del = await fetch(`${base}/api/data?id=TEST02`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ ok: true, removed: 1 });
    expect(await (await fetch(`${base}/api/data?id=TEST02`)).json()).toBeNull();
  });

  it("treats deleting something already gone as success", async () => {
    const del = await fetch(`${base}/api/data?id=GONE99`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect((await del.json()).removed).toBe(0);
  });

  it("rejects an id that could walk out of the data directory", async () => {
    for (const id of ["../etc/passwd", "a/b", "", "x"]) {
      const res = await fetch(`${base}/api/data?id=${encodeURIComponent(id)}`);
      expect(res.status, id).toBe(400);
    }
  });
});
