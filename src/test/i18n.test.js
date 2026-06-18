import { describe, it, expect } from "vitest";
import { makeT, LANGUAGES } from "../i18n.js";

describe("makeT — English", () => {
  const t = makeT("en");

  it("returns a known key", () => {
    expect(t("appTitle")).toBe("Spending Plan");
  });
  it("returns the key itself for unknown key", () => {
    expect(t("no_such_key")).toBe("no_such_key");
  });
  it("interpolates variables", () => {
    expect(t("note_savings", { x: "50" })).toContain("50");
  });
  it("translates category names", () => {
    expect(t.cat("Food")).toBe("Food");
    expect(t.cat("Bills")).toBe("Bills");
  });
  it("translates frequency names", () => {
    expect(t.freq("Monthly")).toBe("Monthly");
    expect(t.freq("Annual")).toBe("Annual");
  });
  it("returns original for unknown category", () => {
    expect(t.cat("Unknown")).toBe("Unknown");
  });
});

describe("makeT — Bulgarian", () => {
  const t = makeT("bg");

  it("returns Bulgarian translation", () => {
    expect(t("appTitle")).toBe("Бюджет");
  });
  it("falls back to English for missing key", () => {
    expect(t("exportPDF")).toBe("Експорт в PDF");
  });
  it("translates Bulgarian categories", () => {
    expect(t.cat("Food")).toBe("Храна");
    expect(t.cat("Bills")).toBe("Сметки");
  });
  it("translates Bulgarian frequencies", () => {
    expect(t.freq("Monthly")).toBe("Месечно");
    expect(t.freq("Annual")).toBe("Годишно");
  });
});

describe("makeT — Spanish", () => {
  const t = makeT("es");

  it("returns Spanish translation", () => {
    expect(t("appTitle")).toBe("Plan de Gastos");
  });
  it("translates Spanish categories", () => {
    expect(t.cat("Food")).toBe("Comida");
  });
  it("translates Spanish frequencies", () => {
    expect(t.freq("Monthly")).toBe("Mensual");
    expect(t.freq("Bi-weekly")).toBe("Quincenal");
  });
});

describe("makeT — unknown language", () => {
  const t = makeT("zz");

  it("falls back to English for unknown language", () => {
    expect(t("appTitle")).toBe("Spending Plan");
  });
});

describe("LANGUAGES", () => {
  it("contains en, bg, es", () => {
    const codes = LANGUAGES.map(l => l.code);
    expect(codes).toContain("en");
    expect(codes).toContain("bg");
    expect(codes).toContain("es");
  });
  it("each language has code, label, flag", () => {
    for (const lang of LANGUAGES) {
      expect(lang).toHaveProperty("code");
      expect(lang).toHaveProperty("label");
      expect(lang).toHaveProperty("flag");
    }
  });
});
