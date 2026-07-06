import { describe, it, expect } from "vitest";
import { freqToMonthly, fmt, computeHealthScore, scoreColor, scoreLabelKey, parseAmount } from "../utils.js";

describe("freqToMonthly", () => {
  it("returns amount unchanged for Monthly", () => {
    expect(freqToMonthly(100, "Monthly")).toBe(100);
  });
  it("divides by 12 for Annual", () => {
    expect(freqToMonthly(1200, "Annual")).toBeCloseTo(100);
  });
  it("converts Weekly to monthly", () => {
    expect(freqToMonthly(100, "Weekly")).toBeCloseTo(434.52, 0);
  });
  it("divides by 3 for Quarterly", () => {
    expect(freqToMonthly(300, "Quarterly")).toBeCloseTo(100);
  });
  it("converts Bi-weekly to monthly", () => {
    expect(freqToMonthly(100, "Bi-weekly")).toBeCloseTo(217.26, 0);
  });
  it("falls back to amount for unknown frequency", () => {
    expect(freqToMonthly(50, "Unknown")).toBe(50);
  });
});

describe("fmt", () => {
  it("formats whole numbers with commas", () => {
    expect(fmt(1234567)).toBe("1,234,567");
  });
  it("rounds fractional values", () => {
    expect(fmt(1.6)).toBe("2");
  });
  it("returns '0' for NaN", () => {
    expect(fmt(NaN)).toBe("0");
  });
  it("returns '0' for Infinity", () => {
    expect(fmt(Infinity)).toBe("0");
  });
  it("returns '0' for -Infinity", () => {
    expect(fmt(-Infinity)).toBe("0");
  });
  it("formats zero", () => {
    expect(fmt(0)).toBe("0");
  });
});

describe("parseAmount", () => {
  it("parses a valid number string", () => {
    expect(parseAmount("42.5")).toBe(42.5);
  });
  it("returns fallback for empty string", () => {
    expect(parseAmount("", 99)).toBe(99);
  });
  it("returns default fallback 0 for empty string", () => {
    expect(parseAmount("")).toBe(0);
  });
  it("returns fallback for non-numeric string", () => {
    expect(parseAmount("abc", 5)).toBe(5);
  });
  it("parses '0' as 0, not fallback", () => {
    expect(parseAmount("0", 99)).toBe(0);
  });
  it("parses '0.00' as 0", () => {
    expect(parseAmount("0.00", 99)).toBe(0);
  });
  it("parses leading decimal like '.5'", () => {
    expect(parseAmount(".5")).toBeCloseTo(0.5);
  });
});

describe("computeHealthScore", () => {
  it("returns null for zero income", () => {
    expect(computeHealthScore(0, 1000, 100, 3)).toBeNull();
  });
  it("returns null for negative income", () => {
    expect(computeHealthScore(-1, 100, 10, 3)).toBeNull();
  });
  it("returns a score between 0 and 100", () => {
    const result = computeHealthScore(5000, 2000, 500, 6);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });
  it("shows 'None' for emergencyMonths === 0", () => {
    const result = computeHealthScore(5000, 2000, 500, 0);
    const emergencyBreakdown = result.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(emergencyBreakdown.value).toBe("None");
  });
  it("shows months label for non-zero emergencyMonths", () => {
    const result = computeHealthScore(5000, 2000, 500, 3);
    const emergencyBreakdown = result.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(emergencyBreakdown.value).toBe("3mo");
  });
  it("gives max score for excellent finances", () => {
    const result = computeHealthScore(10000, 2000, 1500, 6);
    expect(result.total).toBe(100);
  });
  it("has correct breakdown keys", () => {
    const result = computeHealthScore(5000, 2000, 500, 3);
    const keys = result.breakdown.map(b => b.labelKey);
    expect(keys).toContain("score_savingsRate");
    expect(keys).toContain("score_emergencyFund");
    expect(keys).toContain("score_investmentRate");
    expect(keys).toContain("score_expenseRatio");
  });
});

describe("scoreColor", () => {
  it("returns green for score >= 80", () => {
    expect(scoreColor(80)).toBe("#34C759");
    expect(scoreColor(100)).toBe("#34C759");
  });
  it("returns orange for score 60-79", () => {
    expect(scoreColor(60)).toBe("#FF9500");
    expect(scoreColor(79)).toBe("#FF9500");
  });
  it("returns a darker orange for score 40-59", () => {
    expect(scoreColor(40)).toBe("#FF6B00");
    expect(scoreColor(59)).toBe("#FF6B00");
  });
  it("returns red for score < 40", () => {
    expect(scoreColor(0)).toBe("#FF3B30");
    expect(scoreColor(39)).toBe("#FF3B30");
  });
});

describe("scoreLabelKey", () => {
  it("excellent for >= 80", () => {
    expect(scoreLabelKey(80)).toBe("scoreLabel_excellent");
  });
  it("good for 60-79", () => {
    expect(scoreLabelKey(65)).toBe("scoreLabel_good");
  });
  it("fair for 40-59", () => {
    expect(scoreLabelKey(50)).toBe("scoreLabel_fair");
  });
  it("needsWork for < 40", () => {
    expect(scoreLabelKey(20)).toBe("scoreLabel_needsWork");
  });
});
