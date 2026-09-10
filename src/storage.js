import { isNative } from "./native";

// Local copy of the plan. Two jobs: the app opens instantly with real numbers
// instead of example data while the network call is in flight, and it stays
// fully usable with no connection at all.
//
// Capacitor Preferences on device (survives app updates, included in device
// backups); localStorage in the browser. Preferences is async even on web, so
// the whole surface is async and callers await it either way.
const cacheKey = (id) => `plan_cache_${id}`;
const PENDING_KEY = "plan_pending_sync";

async function prefs() {
  const { Preferences } = await import("@capacitor/preferences");
  return Preferences;
}

async function readRaw(key) {
  try {
    if (isNative) return (await prefs()).get({ key }).then((r) => r.value);
    return localStorage.getItem(key);
  } catch {
    return null; // private browsing, cleared storage, quota — treat as empty
  }
}

async function writeRaw(key, value) {
  try {
    if (isNative) await (await prefs()).set({ key, value });
    else localStorage.setItem(key, value);
  } catch {
    /* a failed cache write must never break the app; the remote save still runs */
  }
}

async function removeRaw(key) {
  try {
    if (isNative) await (await prefs()).remove({ key });
    else localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export async function readCache(id) {
  const raw = await readRaw(cacheKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Corrupt entry is worse than none — drop it so it can't wedge every load.
    await removeRaw(cacheKey(id));
    return null;
  }
}

export async function writeCache(id, payload) {
  await writeRaw(cacheKey(id), JSON.stringify(payload));
}

export async function clearCache(id) {
  await removeRaw(cacheKey(id));
}

/**
 * Marks that the cache holds changes the server has not accepted yet, so a
 * later launch (not just a reconnect in the same session) still knows to push.
 */
export async function setPendingSync(id) {
  await writeRaw(PENDING_KEY, id);
}

export async function getPendingSync() {
  return await readRaw(PENDING_KEY);
}

export async function clearPendingSync() {
  await removeRaw(PENDING_KEY);
}
