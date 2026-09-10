import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

/**
 * Native-shell setup. Every call is behind isNative so the web build imports
 * this, does nothing, and pays only the (tiny) cost of the Capacitor core
 * shim — the plugin modules are loaded lazily and never fetched on the web.
 */
export async function initNative() {
  if (!isNative) return;

  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);

  // Style.Light means dark text — correct for the app's light header.
  // Wrapped because the status bar API is unavailable on iPad multitasking
  // in some configurations and throws rather than no-ops.
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch { /* leave the system default */ }

  // The splash is held (launchAutoHide: false) until the first render, so the
  // user never sees an empty WebView between launch and paint.
  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch { /* already hidden */ }
}

/**
 * Hands the generated report to the user.
 *
 * On the web an object URL opened in a new tab is fine. In a WebView it is
 * not: there is no tab to open, so the old approach silently did nothing.
 * Natively the file is written to the cache directory and passed to the
 * system share sheet, which is also where "Save to Files" and "Print" live.
 */
export async function shareReport(html, filename = "spending-plan.html") {
  if (!isNative) {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { ok: true };
  }

  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  // Cache rather than Documents: this is a throwaway artefact the user is
  // about to send somewhere, not something to accumulate in their file list.
  const written = await Filesystem.writeFile({
    path: filename,
    data: html,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: "Spending Plan", url: written.uri });
  return { ok: true };
}

// Notification ids must be 32-bit ints, but bill ids are Date.now()-based and
// far too large, so they are folded down. Collisions would only mean two bills
// sharing a slot; the reschedule below rebuilds the whole set anyway.
export function notificationId(key) {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000;
}

/**
 * Replaces the scheduled bill reminders with one per bill, repeating monthly
 * on its due day. Every call rebuilds the full set rather than diffing, so a
 * renamed, retimed or deleted bill can't leave a stale reminder behind.
 *
 * `items`: [{ key, dueDay, title, body }]
 */
export async function syncBillReminders(items) {
  if (!isNative) return { scheduled: 0 };

  const { LocalNotifications } = await import("@capacitor/local-notifications");

  let granted = (await LocalNotifications.checkPermissions()).display;
  if (granted === "prompt" || granted === "prompt-with-rationale") {
    granted = (await LocalNotifications.requestPermissions()).display;
  }
  if (granted !== "granted") return { scheduled: 0, denied: true };

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const valid = items.filter((b) => Number.isInteger(b.dueDay) && b.dueDay >= 1 && b.dueDay <= 31);
  if (!valid.length) return { scheduled: 0 };

  await LocalNotifications.schedule({
    notifications: valid.map((b) => ({
      id: notificationId(b.key),
      title: b.title,
      body: b.body,
      // Day-of-month repeat. Deliberately on the due day rather than N days
      // before: "two days before the 1st" lands in the previous month and
      // changes length month to month, which is a bug waiting to happen.
      schedule: { on: { day: b.dueDay, hour: 9, minute: 0 }, allowWhileIdle: true },
    })),
  });
  return { scheduled: valid.length };
}

/** Light tap feedback for destructive or committing actions. No-op on web. */
export async function tapFeedback(style = "medium") {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Medium });
  } catch { /* haptics unavailable */ }
}
