import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const native = {
  isNative: false,
  available: true,
  unlockResult: true,
  unlockCalls: 0,
};

vi.mock("../native.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get isNative() { return native.isNative; },
    biometricAvailable: async () => native.available,
    biometricUnlock: async () => { native.unlockCalls++; return native.unlockResult; },
  };
});

const { default: AppLock } = await import("../AppLock.jsx");
const { BIOMETRIC_LOCK_KEY } = await import("../native.js");

const Secret = () => <div>Monthly Income €3,000</div>;

describe("AppLock", () => {
  beforeEach(() => {
    localStorage.clear();
    native.isNative = false;
    native.available = true;
    native.unlockResult = true;
    native.unlockCalls = 0;
  });
  afterEach(() => vi.clearAllMocks());

  it("shows the app straight away when the lock was never turned on", () => {
    render(<AppLock><Secret /></AppLock>);
    expect(screen.getByText(/Monthly Income/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
  });

  // The whole point of the lock. Reading the flag asynchronously and defaulting
  // to unlocked meant the finances were on screen — and in the iOS
  // app-switcher snapshot — for the frames that read took.
  it("never paints the app before the first check when the lock is on", () => {
    localStorage.setItem(BIOMETRIC_LOCK_KEY, "1");
    render(<AppLock><Secret /></AppLock>);
    expect(screen.queryByText(/Monthly Income/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
  });

  it("lets the app through once the check passes", async () => {
    localStorage.setItem(BIOMETRIC_LOCK_KEY, "1");
    render(<AppLock><Secret /></AppLock>);
    expect(await screen.findByText(/Monthly Income/)).toBeInTheDocument();
  });

  it("stays locked and offers a retry when the check fails", async () => {
    localStorage.setItem(BIOMETRIC_LOCK_KEY, "1");
    native.unlockResult = false;
    render(<AppLock><Secret /></AppLock>);
    expect(await screen.findByText("Unlock failed. Try again.")).toBeInTheDocument();
    expect(screen.queryByText(/Monthly Income/)).not.toBeInTheDocument();
  });

  // A stale hint must not strand someone out of their own data.
  it("opens up when the hint says locked but the hardware is gone", async () => {
    localStorage.setItem(BIOMETRIC_LOCK_KEY, "1");
    native.available = false;
    render(<AppLock><Secret /></AppLock>);
    await waitFor(() => expect(screen.getByText(/Monthly Income/)).toBeInTheDocument());
    expect(native.unlockCalls).toBe(0);
  });
});
