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

/** Light tap feedback for destructive or committing actions. No-op on web. */
export async function tapFeedback(style = "medium") {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] ?? ImpactStyle.Medium });
  } catch { /* haptics unavailable */ }
}
