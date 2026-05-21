import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const PORT = process.env.PORT || 3001;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json());

function dataFile(id) {
  return join(DATA_DIR, `spending-plan-${id}.json`);
}

app.get("/api/data", (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    const file = dataFile(id);
    res.json(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
  } catch {
    res.status(500).json({ error: "Failed to read data" });
  }
});

app.post("/api/data", (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    writeFileSync(dataFile(id), JSON.stringify(req.body, null, 2), "utf8");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save data" });
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
if (process.env.NODE_ENV === "production") {
  const distDir = join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(join(distDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
