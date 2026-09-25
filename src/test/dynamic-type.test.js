import { describe, it, expect, vi, afterEach } from "vitest";
import {
  measureBodyPx, scaleFor, applyDynamicType,
  BASE_ROOT_PX, MIN_SCALE, MAX_SCALE,
} from "../dynamicType.js";

// A WKWebView does not scale web content to the system text size. The one hook
// iOS gives the web is the CSS system font: an element set to
// `font: -apple-system-body` renders at the user's chosen body size.
function fakeDocument({ fontSize, fontFamily }) {
  const el = { style: { cssText: "", setProperty() {} }, textContent: "", remove: () => {} };
  const dispatched = [];
  return {
    dispatched,
    body: { appendChild: () => {} },
    documentElement: { style: { setProperty(k, v) { this[k] = v; } } },
    createElement: () => el,
    defaultView: {
      getComputedStyle: () => ({ fontSize, fontFamily }),
      Event: class { constructor(type) { this.type = type; } },
      dispatchEvent: (e) => dispatched.push(e.type),
    },
  };
}

describe("scaleFor", () => {
  it("is exactly 1 at iOS's default body size", () => {
    expect(scaleFor(17)).toBe(1);
  });

  it("follows the standard Dynamic Type range", () => {
    expect(scaleFor(14)).toBeCloseTo(14 / 17, 4);  // xSmall
    expect(scaleFor(23)).toBeCloseTo(23 / 17, 4);  // xxxLarge
  });

  // Spacing and containers are still fixed pixels; past the cap the text stops
  // fitting what holds it.
  it("caps the accessibility sizes rather than breaking the layout", () => {
    expect(scaleFor(53)).toBe(MAX_SCALE);
    expect(scaleFor(1)).toBe(MIN_SCALE);
  });

  it("treats nonsense as no change at all", () => {
    for (const bad of [0, -5, NaN, null, undefined, "big"]) {
      expect(scaleFor(bad), String(bad)).toBe(1);
    }
  });
});

describe("measureBodyPx", () => {
  it("reads the size the system font resolved to", () => {
    expect(measureBodyPx(fakeDocument({ fontSize: "23px", fontFamily: "-apple-system" }))).toBe(23);
  });

  // Every browser outside Apple's ignores the keyword, and the probe then just
  // inherits — which reads exactly like a real answer unless it is checked.
  it("reports nothing where the keyword was not understood", () => {
    expect(measureBodyPx(fakeDocument({ fontSize: "16px", fontFamily: "Arial" }))).toBeNull();
  });

  it("reports nothing rather than throwing when there is no document", () => {
    expect(measureBodyPx(null)).toBeNull();
    expect(measureBodyPx({})).toBeNull();
  });
});

describe("applyDynamicType", () => {
  afterEach(() => { document.documentElement.style.fontSize = ""; });

  it("sets the root size from the measurement", () => {
    const doc = fakeDocument({ fontSize: "23px", fontFamily: "-apple-system" });
    const scale = applyDynamicType(doc);
    expect(scale).toBeCloseTo(23 / 17, 4);
    expect(doc.documentElement.style.fontSize).toBe(`${BASE_ROOT_PX * scale}px`);
  });

  // The whole conversion to rem is a visual no-op anywhere the root is
  // untouched, which is what keeps the web build looking exactly as it did.
  it("leaves the root alone where the platform has no opinion", () => {
    const doc = fakeDocument({ fontSize: "16px", fontFamily: "Arial" });
    expect(applyDynamicType(doc)).toBeNull();
    expect(doc.documentElement.style.fontSize).toBeUndefined();
  });

  // The viewport did not change in pixels, but it did in the unit that decides
  // the layout: how many words fit across.
  it("tells the page to re-measure when the size moved", () => {
    const doc = fakeDocument({ fontSize: "23px", fontFamily: "-apple-system" });
    applyDynamicType(doc);
    expect(doc.dispatched).toEqual(["resize"]);
  });

  it("stays quiet when the size is unchanged", () => {
    const doc = fakeDocument({ fontSize: "23px", fontFamily: "-apple-system" });
    applyDynamicType(doc);
    doc.dispatched.length = 0;
    applyDynamicType(doc);
    expect(doc.dispatched).toEqual([]);
  });

  it("does nothing in a real jsdom document, which has no such keyword", () => {
    expect(applyDynamicType(document)).toBeNull();
    expect(document.documentElement.style.fontSize).toBe("");
  });
});
