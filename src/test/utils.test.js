import { describe, it, expect } from "vitest";
import { freqToMonthly, fmt, computeHealthScore } from "../utils.js";

describe("freqToMonthly", () => {
  it("passes Monthly through unchanged", () => { expect(freqToMonthly(100, "Monthly")).toBe(100); });
  it("divides Annual by 12", () => { expect(freqToMonthly(1200, "Annual")).toBeCloseTo(100); });
  it("converts Weekly correctly", () => { expect(freqToMonthly(100, "Weekly")).toBeCloseTo(434.52, 0); });
  it("converts Quarterly correctly", () => { expect(freqToMonthly(300, "Quarterly")).toBeCloseTo(100); });
  it("converts Bi-weekly correctly", () => { expect(freqToMonthly(200, "Bi-weekly")).toBeCloseTo(434.52, 0); });
  it("falls back to Monthly for unknown frequency", () => { expect(freqToMonthly(50, "Unknown")).toBe(50); });
  it("returns 0 for 0 amount", () => { expect(freqToMonthly(0, "Monthly")).toBe(0); });
});

describe("fmt", () => {
  it("formats integer amounts", () => { expect(fmt(1234)).toBe("1,234"); });
  it("rounds decimals", () => { expect(fmt(1234.7)).toBe("1,235"); });
  it("handles zero", () => { expect(fmt(0)).toBe("0"); });
  it("handles negative", () => { expect(fmt(-500)).toBe("-500"); });
  it("handles NaN safely", () => { expect(fmt(NaN)).toBe("0"); });
  it("handles Infinity safely", () => { expect(fmt(Infinity)).toBe("0"); });
});

describe("computeHealthScore", () => {
  it("returns null when totalIncome is 0", () => { expect(computeHealthScore(0, 1000, 100, 3)).toBeNull(); });
  it("gives full score for perfect finances", () => {
    // income=10000, expenses=4000, invest=1000, savings=5000 (50% savings), 6mo emergency
    const s = computeHealthScore(10000, 4000, 1000, 6);
    expect(s.total).toBe(100);
  });
  it("total is sum of breakdown scores", () => {
    const s = computeHealthScore(3500, 2000, 350, 3);
    const sum = s.breakdown.reduce((acc, b) => acc + b.score, 0);
    expect(s.total).toBe(sum);
  });
  it("scores 0 for emergency when months=0", () => {
    const s = computeHealthScore(5000, 2000, 500, 0);
    const ef = s.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(ef.score).toBe(0);
  });
  it("score components are between 0 and 25", () => {
    const s = computeHealthScore(3000, 2500, 100, 6);
    s.breakdown.forEach(b => { expect(b.score).toBeGreaterThanOrEqual(0); expect(b.score).toBeLessThanOrEqual(25); });
  });
  it("emergencyMonths=0 shows None in value", () => {
    const s = computeHealthScore(5000, 2000, 500, 0);
    const ef = s.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(ef.value).toBe("None");
  });
});
