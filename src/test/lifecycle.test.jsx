import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Reference-stable, or AuthBridge's effect re-fires every render (see
// import.test.jsx).
vi.mock("@clerk/clerk-react", () => {
  const user = { id: "user_NEW", primaryEmailAddress: { emailAddress: "m@example.com" } };
  const state = { isLoaded: true, isSignedIn: true, user };
  const authState = { getToken: async () => "test-token" };
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
  updatedAt: 1000,
};

describe("saving when the app leaves the foreground", () => {
  let posts;

  beforeEach(async () => {
    posts = [];
    global.fetch = vi.fn(async (url, opts) => {
      const id = new URL(url, "http://localhost").searchParams.get("id");
      if (opts?.method === "POST") {
        posts.push({ id, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => (id === "user_NEW" ? plan : null) };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
    localStorage.setItem(CACHE_KEY, JSON.stringify(plan));
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await screen.findByText("€3,000");
    posts.length = 0;
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("writes a pending edit out instead of waiting for the debounce", async () => {
    const user = userEvent.setup();
    // Any edit will do; the emergency-fund target is a single unambiguous tap.
    await user.click(screen.getByRole("button", { name: "6m" }));
    expect(posts).toHaveLength(0); // still inside the 2s debounce

    // Backgrounding the app. iOS does not run the pending timer afterwards, so
    // without this the edit is lost from the device as well as the server.
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    window.dispatchEvent(new Event("pagehide"));

    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    expect(posts.at(-1).body.emergencyMonths).toBe(6);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CACHE_KEY)).emergencyMonths).toBe(6);
    });
  });

  it("does not post anything when there is no pending edit", async () => {
    window.dispatchEvent(new Event("pagehide"));
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toHaveLength(0);
  });
});
