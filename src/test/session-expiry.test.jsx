import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@clerk/clerk-react", () => {
  const user = { id: "user_NEW", primaryEmailAddress: { emailAddress: "m@example.com" } };
  const state = { isLoaded: true, isSignedIn: true, user };
  const authState = { getToken: async () => "expired-token" };
  return {
    useUser: () => state,
    useAuth: () => authState,
    UserButton: () => <div data-testid="user-button" />,
    SignInButton: ({ children }) => <>{children}</>,
  };
});

const CACHE_KEY = "plan_cache_user_NEW";
const plan = {
  income: [{ id: 1, name: "Salary", amount: 3000, frequency: "Monthly" }],
  expenses: [{ id: 1, name: "Rent", type: "Utilities", category: "Bills", amount: 100, frequency: "Monthly" }],
  emergencyMonths: 3,
  updatedAt: 1000,
};

// Once CLERK_SECRET_KEY is set in Vercel, the server refuses a write that
// carries no valid session. Sessions expire, so this is an ordinary Tuesday,
// not an exotic failure.
describe("a write the server refuses as unauthenticated", () => {
  let writeStatus;

  beforeEach(async () => {
    writeStatus = 401;
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "POST") {
        return { ok: writeStatus === 200, status: writeStatus, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => plan };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
    localStorage.setItem(CACHE_KEY, JSON.stringify(plan));
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await screen.findByText("€3,000");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("says to sign in again rather than offering a doomed retry", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "6m" }));
    window.dispatchEvent(new Event("pagehide"));

    expect(await screen.findByText(/Sign in again to save/)).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't save/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
  });

  it("keeps the edit on the device so signing back in recovers it", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "6m" }));
    window.dispatchEvent(new Event("pagehide"));

    await screen.findByText(/Sign in again to save/);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CACHE_KEY)).emergencyMonths).toBe(6);
    });
    expect(localStorage.getItem("plan_pending_sync")).toBe("user_NEW");
  });

  it("still calls an ordinary server failure a save failure", async () => {
    writeStatus = 500;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "12m" }));
    window.dispatchEvent(new Event("pagehide"));

    expect(await screen.findByText(/Couldn't save/)).toBeInTheDocument();
    expect(screen.queryByText(/Sign in again/)).not.toBeInTheDocument();
  });
});

// Account deletion is the one flow App Review specifically checks. "Could not
// delete the account: API 401" tells the person nothing they can act on.
describe("an expired session in the flows that are not autosave", () => {
  beforeEach(async () => {
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "DELETE" || opts?.method === "POST") {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => plan };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
    localStorage.setItem(CACHE_KEY, JSON.stringify(plan));
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await screen.findByText("€3,000");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("says what to do when deleting the account is refused", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Delete my account/ }));
    await user.type(screen.getByLabelText(/Type DELETE/), "DELETE");
    await user.click(screen.getByRole("button", { name: /Delete permanently/ }));
    expect(await screen.findByText(/Sign in again and try once more/)).toBeInTheDocument();
    expect(screen.queryByText(/API 401/)).not.toBeInTheDocument();
  });

  it("says what to do when an import is refused", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Import data from another account/ }));
    await user.type(screen.getByPlaceholderText(/Account ID/), "user_OLD");
    await user.click(screen.getByRole("button", { name: /^Import$/ }));
    expect(await screen.findByText(/Sign in again and try once more/)).toBeInTheDocument();
    expect(screen.queryByText(/API 401/)).not.toBeInTheDocument();
  });
});
