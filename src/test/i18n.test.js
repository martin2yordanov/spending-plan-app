import { describe, it, expect } from "vitest";
import { makeT } from "../i18n.js";

describe("makeT", () => {
  it("returns english strings for en", () => {
    const t = makeT("en");
    expect(t("appTitle")).toBe("Spending Plan");
  });
  it("returns bulgarian strings for bg", () => {
    const t = makeT("bg");
    expect(t("appTitle")).toBe("Бюджет");
  });
  it("falls back to en for unknown key", () => {
    const t = makeT("bg");
    expect(t("appTitle")).not.toBe("appTitle");
  });
  it("falls back to en for unknown lang", () => {
    const t = makeT("xx");
    expect(t("appTitle")).toBe("Spending Plan");
  });
  it("interpolates variables", () => {
    const t = makeT("en");
    expect(t("perMonthMonths", { x: "100", n: "3" })).toBe("100/mo × 3 months");
  });
  it("translates category names", () => {
    const t = makeT("bg");
    expect(t.cat("Child")).toBe("Деца");
  });
  it("translates frequencies", () => {
    const t = makeT("bg");
    expect(t.freq("Monthly")).toBe("Месечно");
  });
  it("returns raw key for completely unknown key", () => {
    const t = makeT("en");
    expect(t("nonExistentKey_xyz")).toBe("nonExistentKey_xyz");
  });
});
