import { describe, it, expect } from "vitest";
import { notificationId } from "../native.js";

describe("notificationId", () => {
  it("is stable for the same key", () => {
    expect(notificationId("bill-1")).toBe(notificationId("bill-1"));
  });
  it("stays inside the 32-bit positive range iOS requires", () => {
    for (const key of ["a", "bill-1", Date.now(), "x".repeat(200), "", "Сметка", 0, -5]) {
      const id = notificationId(key);
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(2 ** 31);
    }
  });
  it("separates the large timestamp-style ids bills actually use", () => {
    const ids = new Set([1772000000001, 1772000000002, 1772000000003].map(notificationId));
    expect(ids.size).toBe(3);
  });
});
