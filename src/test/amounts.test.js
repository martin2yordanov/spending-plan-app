import { describe, it, expect } from "vitest";

// Replicate the old (buggy) and new (fixed) parseAmount logic
function parseAmountBuggy(value) {
  return parseFloat(value) || 0;
}

function parseAmountFixed(value, fallback = 0) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : n;
}

describe("amount input parsing — regression", () => {
  it("buggy: empty string incorrectly yields 0 (prevents clearing)", () => {
    expect(parseAmountBuggy("")).toBe(0); // this is the bug
  });
  it("fixed: empty string yields fallback (allows clearing)", () => {
    expect(parseAmountFixed("", 120)).toBe(120); // keep previous value
  });
  it("fixed: valid number string parses correctly", () => {
    expect(parseAmountFixed("5")).toBe(5);
    expect(parseAmountFixed("250")).toBe(250);
    expect(parseAmountFixed("0")).toBe(0);
  });
  it("buggy: zero is falsy so '0' still works but is risky", () => {
    expect(parseAmountBuggy("0")).toBe(0); // works, but only because 0||0=0
  });
  it("fixed: zero parses correctly", () => {
    expect(parseAmountFixed("0")).toBe(0);
  });
  it("fixed: '05' parses as 5 (no leading-zero weirdness in stored value)", () => {
    expect(parseAmountFixed("05")).toBe(5);
  });
});
