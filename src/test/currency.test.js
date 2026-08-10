import { describe, it, expect } from "vitest";
import {
  CURRENCIES, DEFAULT_CURRENCY, BGN_PER_EUR,
  currencyMeta, makeMoney, conversionRate, convertAmount, computeHealthScore,
} from "../utils.js";

describe("currencyMeta", () => {
  it("looks up a known currency", () => {
    expect(currencyMeta("BGN").symbol).toBe("лв");
  });
  it("falls back to the first currency for unknown/missing codes", () => {
    expect(currencyMeta("XYZ").code).toBe("EUR");
    expect(currencyMeta(undefined).code).toBe("EUR");
  });
  it("defaults to EUR so existing plans keep their previous display", () => {
    expect(DEFAULT_CURRENCY).toBe("EUR");
  });
});

describe("makeMoney", () => {
  it("puts the euro sign before the amount", () => {
    expect(makeMoney("EUR")(1234)).toBe("€1,234");
  });
  it("puts the lev after the amount, per local convention", () => {
    expect(makeMoney("BGN")(1234)).toBe("1,234 лв");
  });
  it("handles dollar and pound", () => {
    expect(makeMoney("USD")(50)).toBe("$50");
    expect(makeMoney("GBP")(50)).toBe("£50");
  });
  it("inherits fmt's rounding and NaN handling", () => {
    expect(makeMoney("EUR")(1.6)).toBe("€2");
    expect(makeMoney("EUR")(NaN)).toBe("€0");
  });
  it("falls back to euro formatting for an unknown code", () => {
    expect(makeMoney("XYZ")(10)).toBe("€10");
  });
});

describe("conversionRate", () => {
  it("is 1 for the same currency", () => {
    expect(conversionRate("EUR", "EUR")).toBe(1);
    expect(conversionRate("BGN", "BGN")).toBe(1);
  });
  it("uses the fixed peg both ways", () => {
    expect(conversionRate("EUR", "BGN")).toBe(BGN_PER_EUR);
    expect(conversionRate("BGN", "EUR")).toBeCloseTo(1 / BGN_PER_EUR, 10);
  });
  it("returns null for pairs with no offline rate, rather than guessing", () => {
    expect(conversionRate("EUR", "USD")).toBeNull();
    expect(conversionRate("USD", "BGN")).toBeNull();
  });
  it("pins the peg to the official euro-adoption rate", () => {
    expect(BGN_PER_EUR).toBe(1.95583);
  });
});

describe("convertAmount", () => {
  it("converts BGN to EUR at the peg, rounded to cents", () => {
    expect(convertAmount(5465, "BGN", "EUR")).toBe(2794.21);
    expect(convertAmount(60, "BGN", "EUR")).toBe(30.68);
  });
  it("converts EUR to BGN", () => {
    expect(convertAmount(100, "EUR", "BGN")).toBe(195.58);
  });
  it("round-trips within a cent", () => {
    const back = convertAmount(convertAmount(1000, "BGN", "EUR"), "EUR", "BGN");
    expect(Math.abs(back - 1000)).toBeLessThanOrEqual(0.01);
  });
  it("leaves the amount untouched when no rate exists, so nothing is silently mangled", () => {
    expect(convertAmount(123.45, "EUR", "USD")).toBe(123.45);
  });
  it("is a no-op for the same currency", () => {
    expect(convertAmount(123.45, "EUR", "EUR")).toBe(123.45);
  });
});

describe("computeHealthScore currency formatting", () => {
  it("formats note amounts with the injected formatter", () => {
    const result = computeHealthScore(5000, 4500, 0, 0, makeMoney("BGN"));
    const note = result.breakdown.find((b) => b.labelKey === "score_emergencyFund");
    expect(note.noteVars.x).toMatch(/лв$/);
  });
  it("defaults to a bare number when no formatter is passed", () => {
    const result = computeHealthScore(5000, 4500, 0, 0);
    const note = result.breakdown.find((b) => b.labelKey === "score_emergencyFund");
    expect(note.noteVars.x).not.toMatch(/[€$£]|лв/);
  });
  it("keeps the expense-ratio percentage free of any currency symbol", () => {
    const result = computeHealthScore(5000, 4500, 0, 0, makeMoney("EUR"));
    const note = result.breakdown.find((b) => b.labelKey === "score_expenseRatio");
    expect(note.noteVars.p).toBe("90");
  });
});

describe("translation templates carry no hardcoded currency", () => {
  it("no locale embeds a currency symbol in a money template", async () => {
    const src = await import("../i18n.js");
    for (const lang of ["en", "bg", "es"]) {
      const t = src.makeT(lang);
      // These keys interpolate money the caller has already formatted.
      for (const key of ["note_savings", "sts_leftThisMonth", "goal_needed", "coverageFromDedicated"]) {
        expect(t(key, { x: "X" })).not.toMatch(/[€$£]|лв/);
      }
      // These label a field and take the active symbol via {c}.
      expect(t("ph_limit", { c: "лв" })).toContain("лв");
      expect(t("goal_targetAmount", { c: "$" })).toContain("$");
    }
  });
});

describe("CURRENCIES list", () => {
  it("has unique codes and complete metadata", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of CURRENCIES) {
      expect(c.symbol).toBeTruthy();
      expect(c.flag).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(typeof c.suffix).toBe("boolean");
    }
  });
});
