import { describe, it, expect } from "vitest";
import { freqToMonthly, fmt, computeHealthScore, computeEmergencyFundCoverage, emergencyFundWeight, scoreColor, scoreLabelKey, parseAmount } from "../utils.js";

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
  // The 4th argument is Emergency Fund coverage in euros (real money,
  // weighted per computeEmergencyFundCoverage) — not a chosen target-months
  // value. monthsCovered is derived internally as coverage / (expenses + invest).
  it("returns null for zero income", () => {
    expect(computeHealthScore(0, 1000, 100, 3000)).toBeNull();
  });
  it("returns null for negative income", () => {
    expect(computeHealthScore(-1, 100, 10, 300)).toBeNull();
  });
  it("returns a score between 0 and 100", () => {
    const result = computeHealthScore(5000, 2000, 500, 15000);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });
  it("shows 'None' for zero coverage", () => {
    const result = computeHealthScore(5000, 2000, 500, 0);
    const emergencyBreakdown = result.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(emergencyBreakdown.value).toBe("None");
  });
  it("shows months label derived from real coverage, not a target", () => {
    // monthlyOutflow = 2000 (expenses) + 500 (invest) = 2500; 7500 / 2500 = 3mo.
    const result = computeHealthScore(5000, 2000, 500, 7500);
    const emergencyBreakdown = result.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(emergencyBreakdown.value).toBe("3mo");
  });
  it("gives max score for excellent finances with 6+ months covered", () => {
    // monthlyOutflow = 2000 + 1500 = 3500; need >= 21000 for 6mo.
    const result = computeHealthScore(10000, 2000, 1500, 21000);
    expect(result.total).toBe(100);
  });
  it("does not give a full emergency score just because a large target was picked with no real coverage", () => {
    // Regression guard: previously the 4th arg was the chosen target
    // (0/3/6/12), so picking "12" alone maxed this pillar with €0 saved.
    const result = computeHealthScore(5000, 2000, 500, 0);
    const emergencyBreakdown = result.breakdown.find(b => b.labelKey === "score_emergencyFund");
    expect(emergencyBreakdown.score).toBe(0);
  });
  it("has correct breakdown keys", () => {
    const result = computeHealthScore(5000, 2000, 500, 3000);
    const keys = result.breakdown.map(b => b.labelKey);
    expect(keys).toContain("score_savingsRate");
    expect(keys).toContain("score_emergencyFund");
    expect(keys).toContain("score_investmentRate");
    expect(keys).toContain("score_expenseRatio");
  });
});

describe("emergencyFundWeight", () => {
  it("weights cash and emergency-fund accounts at 100%", () => {
    expect(emergencyFundWeight("cash")).toBe(1);
    expect(emergencyFundWeight("emergency")).toBe(1);
  });
  it("discounts investment accounts to 80%", () => {
    expect(emergencyFundWeight("investment")).toBe(0.8);
  });
  it("defaults untyped/unknown accounts to cash (100%) for backward compatibility", () => {
    expect(emergencyFundWeight(undefined)).toBe(1);
    expect(emergencyFundWeight("something-unrecognized")).toBe(1);
  });
});

describe("computeEmergencyFundCoverage", () => {
  it("returns zero for no accounts", () => {
    expect(computeEmergencyFundCoverage([])).toEqual({ dedicated: 0, fromSavings: 0, total: 0 });
  });
  it("returns zero for undefined input", () => {
    expect(computeEmergencyFundCoverage(undefined)).toEqual({ dedicated: 0, fromSavings: 0, total: 0 });
  });
  it("counts untyped accounts as cash, in full (pre-existing data)", () => {
    const result = computeEmergencyFundCoverage([{ amount: 500 }]);
    expect(result.fromSavings).toBe(500);
    expect(result.total).toBe(500);
  });
  it("counts investment accounts at the discounted weight", () => {
    const result = computeEmergencyFundCoverage([{ amount: 1000, type: "investment" }]);
    expect(result.fromSavings).toBe(800);
    expect(result.total).toBe(800);
  });
  it("matches the worked example: €500 dedicated + €2,000 savings = €2,500 total", () => {
    const result = computeEmergencyFundCoverage([
      { amount: 500, type: "emergency" },
      { amount: 2000, type: "cash" },
    ]);
    expect(result.dedicated).toBe(500);
    expect(result.fromSavings).toBe(2000);
    expect(result.total).toBe(2500);
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
