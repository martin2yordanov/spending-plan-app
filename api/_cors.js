// Origins allowed to call the API from a different origin than it is served
// from. The native shells are the reason this exists: a Capacitor WebView runs
// at capacitor://localhost (iOS) or http://localhost (Android), so every call
// to the deployed API is cross-origin and would otherwise be blocked.
//
// An allowlist rather than "*": these endpoints carry no auth — knowing an id
// is enough to read or write that plan — so there is no reason to invite calls
// from arbitrary web pages on top of that.
const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:5173",
  "https://spending-plan-app.vercel.app",
]);

/**
 * Applies CORS headers when the request comes from a known origin, and answers
 * preflight requests. Returns true if the request was a preflight and has been
 * fully handled, so the caller should stop.
 */
export function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    // Same URL can answer differently per origin, so caches must key on it.
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
