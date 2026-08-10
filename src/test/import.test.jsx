import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Clerk is stubbed as "signed in" so the account-scoped UI renders. Without
// this the app runs in its logged-out demo mode and never persists anything.
// The returned object must be reference-stable: AuthBridge's effect depends on
// `user`, so a fresh object per render would re-fire it forever and lock up the
// event loop. Real Clerk hands back a stable reference.
vi.mock("@clerk/clerk-react", () => {
  const user = { id: "user_NEW", primaryEmailAddress: { emailAddress: "m@example.com" } };
  const state = { isLoaded: true, isSignedIn: true, user };
  return {
    useUser: () => state,
    UserButton: () => <div data-testid="user-button" />,
    SignInButton: ({ children }) => <>{children}</>,
  };
});

const OLD_PLAN = {
  income: [{ id: 1, name: "Embassy Pay", amount: 5465, frequency: "Monthly" }],
  expenses: [{ id: 1, name: "Hot Water", type: "Utilities", category: "Bills", amount: 60, frequency: "Monthly" }],
  invest: 400,
  emergencyMonths: 3,
};

// CLERK_ENABLED is read at module-eval time, so the env has to be stubbed
// before App is imported — hence the per-test import rather than a static one.
async function renderApp() {
  vi.resetModules();
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
  const { default: App } = await import("../App.jsx");
  render(<App />);
}

describe("import from another account", () => {
  let store;

  beforeEach(() => {
    store = { user_OLD: OLD_PLAN };
    global.fetch = vi.fn(async (url, opts) => {
      const id = new URL(url, "http://localhost").searchParams.get("id");
      if (!opts || opts.method !== "POST") {
        return { ok: true, status: 200, json: async () => store[id] ?? null };
      }
      store[id] = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    });
    // Suppress the first-run walkthrough, which would overlay the page.
    localStorage.setItem("walkthrough_done_user_NEW", "1");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("copies a plan from another account id into the signed-in account", async () => {
    const user = userEvent.setup();
    await renderApp();

    // The empty account gets seeded with example data first — that is the
    // exact situation this feature exists to recover from.
    const open = await screen.findByText("Import data from another account");
    await waitFor(() => expect(store.user_NEW).toBeTruthy());
    expect(JSON.stringify(store.user_NEW)).not.toContain("Embassy Pay");

    await user.click(open);

    // The current account id must be visible, otherwise a mismatch is
    // impossible to diagnose from inside the app.
    expect(screen.getByText("user_NEW")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Account ID or sync code/i), "user_OLD");
    await user.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(JSON.stringify(store.user_NEW)).toContain("Embassy Pay"));
    expect(store.user_NEW.invest).toBe(400);
    expect(await screen.findByText(/Data imported/)).toBeInTheDocument();
  });

  it("reports a clear error for an unknown id, leaving current data intact", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(await screen.findByText("Import data from another account"));
    await waitFor(() => expect(store.user_NEW).toBeTruthy());
    const before = JSON.stringify(store.user_NEW);

    await user.type(screen.getByPlaceholderText(/Account ID or sync code/i), "user_MISSING");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText(/No data found for that account ID/)).toBeInTheDocument();
    expect(JSON.stringify(store.user_NEW)).toBe(before);
  });
});
