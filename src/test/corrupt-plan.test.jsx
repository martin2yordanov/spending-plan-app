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

// A stored plan is whatever survived JSON.parse. The screen is built straight
// out of it, so a string where a list belongs used to be a crash — and a crash
// in the top-level component takes the whole app with it.
describe("a plan that is valid JSON but the wrong shape", () => {
  let served;

  beforeEach(() => {
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "POST") return { ok: true, status: 200, json: async () => ({ ok: true }) };
      return { ok: true, status: 200, json: async () => served };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
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

  it("survives lists that are not lists", async () => {
    served = { income: "3000", expenses: { a: 1 }, savingsAccounts: 7, bills: "none", updatedAt: 5 };
    await renderApp();
    await waitFor(() => expect(screen.getByText(/Safe to spend|Over budget/)).toBeInTheDocument());
  });

  it("survives nulls sitting inside a list", async () => {
    served = {
      income: [null, { id: 1, name: "Salary", amount: 2000, frequency: "Monthly" }, undefined],
      expenses: [null, { id: 1, name: "Rent", category: "Bills", amount: 500, frequency: "Monthly" }],
      updatedAt: 5,
    };
    await renderApp();
    // The real rows still land; the junk is dropped rather than crashing.
    expect(await screen.findByText("€2,000")).toBeInTheDocument();
  });

  it("survives numbers that are not numbers", async () => {
    served = {
      income: [{ id: 1, name: "Salary", amount: 2000, frequency: "Monthly" }],
      expenses: [],
      invest: "lots",
      emergencyMonths: {},
      categoryLimits: "none",
      customCategories: [],
      currency: 42,
      updatedAt: 5,
    };
    await renderApp();
    expect(await screen.findByText("€2,000")).toBeInTheDocument();
  });

  it("survives a corrupt local cache the same way", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ income: "nope", expenses: 3, updatedAt: 9999 }));
    served = null;
    await renderApp();
    await waitFor(() => expect(screen.getByText(/Safe to spend|Over budget/)).toBeInTheDocument());
  });
});
