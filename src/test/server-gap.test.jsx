import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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
const realPlan = {
  income: [{ id: 1, name: "Salary", amount: 4321, frequency: "Monthly" }],
  expenses: [{ id: 1, name: "Rent", type: "Utilities", category: "Bills", amount: 100, frequency: "Monthly" }],
  updatedAt: 1000,
};

// A signed-in device holding a real plan, and a server that answers "nothing
// here" — an evicted key, a restore, a write that never landed. That is a gap
// on the server, not a new account.
describe("the server has no copy but the device does", () => {
  let posts;

  beforeEach(() => {
    posts = [];
    global.fetch = vi.fn(async (url, opts) => {
      const id = new URL(url, "http://localhost").searchParams.get("id");
      if (opts?.method === "POST") {
        posts.push({ id, body: JSON.parse(opts.body) });
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => null };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
    localStorage.setItem(CACHE_KEY, JSON.stringify(realPlan));
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function renderApp() {
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    const { default: App } = await import("../App.jsx");
    render(<App />);
  }

  it("keeps the real plan on screen instead of seeding example data over it", async () => {
    await renderApp();
    expect(await screen.findByText("€4,321")).toBeInTheDocument();
    // The example seed is a €3,000 salary plus €500 of side projects.
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    expect(screen.queryByText("€3,500")).not.toBeInTheDocument();
  });

  it("pushes the device's copy up rather than the example data", async () => {
    await renderApp();
    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    for (const p of posts) {
      expect(p.body.income[0].name).toBe("Salary");
      expect(p.body.income[0].amount).toBe(4321);
    }
  });

  it("still seeds example data for a device with no plan at all", async () => {
    localStorage.removeItem(CACHE_KEY);
    await renderApp();
    expect(await screen.findByText("€3,500")).toBeInTheDocument();
  });
});
