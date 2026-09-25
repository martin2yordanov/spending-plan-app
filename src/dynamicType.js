// Dynamic Type for a WebView.
//
// A WKWebView does not scale web content to the system text size — nothing in
// the app knows the setting exists. The one hook iOS does give the web is the
// CSS system font: an element set to `font: -apple-system-body` is rendered at
// the user's chosen body size. Measuring that element is the whole trick.
//
// Everything in the app is then sized in rem against a root that moves with it,
// so one number scales the lot.

// iOS's body size at the default setting. The scale is measured against this,
// so a device sitting on the default lands on exactly 1.
const DEFAULT_BODY_PX = 17;

// The root size the app's rem values were written against: 15px reads as
// 0.9375rem, which is 15px again at a scale of 1. Changing this rescales the
// entire app, which is never what you want.
export const BASE_ROOT_PX = 16;

// Spacing and the containers themselves are still fixed pixels — only the type
// scales — so there is a point past which the text stops fitting what holds it.
// The cap is where the layout was measured to still hold, not a number picked
// for sounding careful: driven at an iPhone SE width, every tab is free of
// horizontal overflow through 2.0 and starts spilling at 2.5.
//
// 2.0 covers the entire standard range (xSmall through xxxLarge, 14px to 23px,
// so to 1.35) and the first two accessibility steps (AX1 and AX2). The largest
// settings keep scaling everything else iOS draws; they just stop scaling this.
export const MIN_SCALE = 0.8;
export const MAX_SCALE = 2;

/**
 * The user's body text size in CSS pixels, or null where the platform has no
 * opinion — every browser outside Apple's, and any failure at all.
 */
export function measureBodyPx(doc = typeof document === "undefined" ? null : document) {
  if (!doc?.body) return null;
  const probe = doc.createElement("span");
  // Off-screen rather than hidden: `display: none` has no computed font size
  // worth reading.
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
  probe.textContent = "M";
  try {
    doc.body.appendChild(probe);
    // A browser that does not know the keyword leaves the shorthand unset and
    // the span simply inherits, which is indistinguishable from a real answer —
    // so the keyword has to be confirmed to have taken.
    const style = doc.defaultView?.getComputedStyle?.(probe);
    if (!style) return null;
    const applied = style.fontFamily || "";
    if (!/-apple-system|system-ui|\.AppleSystem|SF Pro/i.test(applied)) return null;
    const px = parseFloat(style.fontSize);
    return Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    return null;
  } finally {
    probe.remove();
  }
}

/** The measured size as a multiple of the default, clamped to what holds up. */
export function scaleFor(bodyPx) {
  if (!Number.isFinite(bodyPx) || bodyPx <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, bodyPx / DEFAULT_BODY_PX));
}

/**
 * Measures and applies. Returns the scale applied, or null when the platform
 * had no opinion and the root was left alone.
 */
export function applyDynamicType(doc = typeof document === "undefined" ? null : document) {
  const bodyPx = measureBodyPx(doc);
  if (bodyPx == null) return null;

  const scale = scaleFor(bodyPx);
  const next = `${BASE_ROOT_PX * scale}px`;
  const changed = doc.documentElement.style.fontSize !== next;

  doc.documentElement.style.fontSize = next;
  // For anything that wants to react to the setting in CSS rather than in JS.
  doc.documentElement.style.setProperty("--dynamic-type-scale", String(scale));

  // The viewport did not change in pixels, but it did in the unit that decides
  // the layout — how many words fit across. A resize is the signal everything
  // already listens to for exactly that, so the breakpoint and anything else
  // measuring the screen get to reconsider.
  if (changed) {
    try {
      doc.defaultView?.dispatchEvent?.(new doc.defaultView.Event("resize"));
    } catch { /* nothing is listening, or there is no window to tell */ }
  }
  return scale;
}
