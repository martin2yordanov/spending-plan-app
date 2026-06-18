import { describe, it, expect } from "vitest";
import { parseAmount } from "../utils.js";

// Regression tests for the sticky-zero / "05" input bug.
// Root cause: `parseFloat(value) || 0` treats "" as 0 (can't clear field)
// and treats the literal number 0 as falsy (reverts to fallback).
// Fix: parseAmount uses isNaN check so 0 stays 0 and "" returns fallback.

describe("parseAmount — sticky-zero regression", () => {
  it("typing '0' produces 0, not the fallback", () => {
    expect(parseAmount("0", 500)).toBe(0);
  });
  it("clearing the field ('') returns the fallback, not 0", () => {
    expect(parseAmount("", 150)).toBe(150);
  });
  it("typing '5' after clearing gives 5, not '05' or 0", () => {
    // Simulates: user clears → "" (returns fallback) → types "5"
    const afterClear = parseAmount("", 10);
    expect(afterClear).toBe(10); // keeps previous value while field is empty
    const afterType = parseAmount("5", 10);
    expect(afterType).toBe(5); // commits correctly
  });
  it("large amount parses correctly", () => {
    expect(parseAmount("1250.50")).toBeCloseTo(1250.5);
  });
  it("negative amounts parse correctly", () => {
    expect(parseAmount("-100")).toBe(-100);
  });
  it("leading zeros in string ('05') parse as 5", () => {
    expect(parseAmount("05")).toBe(5);
  });
  it("whitespace-only string returns fallback", () => {
    expect(parseAmount("   ", 99)).toBe(99);
  });
  it("null-like values return fallback", () => {
    expect(parseAmount(undefined, 7)).toBe(7);
    expect(parseAmount(null, 7)).toBe(7);
  });
});

describe("parseAmount — edge cases", () => {
  it("scientific notation parses", () => {
    expect(parseAmount("1e3")).toBe(1000);
  });
  it("decimal-only '0.5' parses", () => {
    expect(parseAmount("0.5")).toBeCloseTo(0.5);
  });
  it("integer zero string '0.00' parses as 0", () => {
    expect(parseAmount("0.00", 42)).toBe(0);
  });
});
