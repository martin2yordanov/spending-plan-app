import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// syncBillReminders is a no-op off-device, so the native flag has to be forced
// before the module under test reads it.
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));

const calls = { requested: 0, scheduled: [], cancelled: 0 };
let permission = "prompt";
let pending = [];

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: permission }),
    requestPermissions: async () => { calls.requested++; permission = "granted"; return { display: permission }; },
    getPending: async () => ({ notifications: pending }),
    cancel: async () => { calls.cancelled++; pending = []; },
    schedule: async ({ notifications }) => { calls.scheduled.push(notifications); },
  },
}));

const { syncBillReminders } = await import("../native.js");

describe("bill reminders", () => {
  beforeEach(() => {
    calls.requested = 0; calls.scheduled = []; calls.cancelled = 0;
    permission = "prompt";
    pending = [];
  });
  afterEach(() => vi.clearAllMocks());

  // This runs on every launch. Asking for notifications before the user has
  // set up a single reminder is a bad first impression and the sort of
  // unprompted permission request App Review asks about.
  it("does not ask for permission when there is nothing to schedule", async () => {
    expect(await syncBillReminders([])).toEqual({ scheduled: 0 });
    expect(calls.requested).toBe(0);
  });

  it("does not ask for a list of bills that all have unusable due days", async () => {
    await syncBillReminders([{ key: 1, dueDay: NaN }, { key: 2, dueDay: 44 }]);
    expect(calls.requested).toBe(0);
    expect(calls.scheduled).toHaveLength(0);
  });

  it("asks once there is a real bill to schedule", async () => {
    const res = await syncBillReminders([{ key: 1, dueDay: 5, title: "Rent", body: "€500" }]);
    expect(calls.requested).toBe(1);
    expect(res).toEqual({ scheduled: 1 });
    expect(calls.scheduled[0][0]).toMatchObject({ title: "Rent", body: "€500" });
  });

  it("clears reminders left over from a deleted bill without re-prompting", async () => {
    permission = "granted";
    pending = [{ id: 7 }];
    await syncBillReminders([]);
    expect(calls.requested).toBe(0);
    expect(calls.cancelled).toBe(1);
  });

  it("reports a refusal rather than scheduling into the void", async () => {
    permission = "denied";
    expect(await syncBillReminders([{ key: 1, dueDay: 5 }])).toEqual({ scheduled: 0, denied: true });
    expect(calls.scheduled).toHaveLength(0);
  });
});
