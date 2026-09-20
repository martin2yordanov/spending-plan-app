import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Local development server. It stands in for the Vercel functions in api/, but
// it is NOT equivalent to them: it stores plans as files instead of in Redis,
// and it does not verify Clerk sessions or rate limit anything. Do not put this
// on the public internet — deploy api/ to Vercel, which is what it is for.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const PORT = process.env.PORT || 3001;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export function createApp({ serveStatic = process.env.NODE_ENV === "production" } = {}) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  // Same rule as api/data.js: sync codes and Clerk user IDs only. Anything else
  // (e.g. path separators) is rejected before it can reach the filesystem.
  const VALID_ID = /^[A-Za-z0-9_-]{4,64}$/;

  function dataFile(id) {
    return join(DATA_DIR, `spending-plan-${id}.json`);
  }

  function readId(req, res) {
    const { id } = req.query;
    if (!id || !VALID_ID.test(id)) {
      res.status(400).json({ error: "Missing or invalid id" });
      return null;
    }
    return id;
  }

  app.get("/api/data", (req, res) => {
    const id = readId(req, res);
    if (!id) return;
    try {
      const file = dataFile(id);
      res.json(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
    } catch {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.post("/api/data", (req, res) => {
    const id = readId(req, res);
    if (!id) return;
    try {
      writeFileSync(dataFile(id), JSON.stringify(req.body, null, 2), "utf8");
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  // Account deletion has to work here too, or the one flow App Review checks for
  // (guideline 5.1.1(v)) is the one flow that cannot be tried locally. Deleting
  // something already gone is still success from the caller's side, same as the
  // Redis version.
  app.delete("/api/data", (req, res) => {
    const id = readId(req, res);
    if (!id) return;
    try {
      const file = dataFile(id);
      const existed = existsSync(file);
      if (existed) unlinkSync(file);
      res.json({ ok: true, removed: existed ? 1 : 0 });
    } catch {
      res.status(500).json({ error: "Failed to delete data" });
    }
  });

  app.post("/api/suggestions", async (req, res) => {
    try {
      const mod = await import("./api/suggestions.js");
      await mod.default(req, res);
    } catch (err) {
      console.error("[server /api/suggestions]", err);
      res.status(500).json({ error: err?.message ?? "Internal error" });
    }
  });

  // Serve built frontend in production
  if (serveStatic) {
    const distDir = join(__dirname, "dist");
    app.use(express.static(distDir));
    // A plain middleware rather than app.get("*"): Express 5 moved to a
    // path-to-regexp that rejects a bare "*", and the old spelling did not fail
    // at request time — it threw on startup, so `npm start` did not run at all.
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
      res.sendFile(join(distDir, "index.html"));
    });
  }

  return app;
}

// Only listen when run directly, so the tests can mount the same app on an
// ephemeral port. Registering the routes is the part that used to throw.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  createApp().listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
