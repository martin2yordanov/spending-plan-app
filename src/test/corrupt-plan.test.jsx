import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// Rows are addressed by id everywhere — the React key, editing, deleting. Two
// rows sharing one means every edit touches both, which reads as the app
// changing a figure nobody touched.
describe("a plan whose rows share ids", () => {
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

  it("edits only the row that was opened", async () => {
    const user = userEvent.setup();
    served = {
      income: [
        { id: 7, name: "Salary", amount: 1000, frequency: "Monthly" },
        { id: 7, name: "Freelance", amount: 2000, frequency: "Monthly" },
      ],
      expenses: [],
      updatedAt: 5,
    };
    await renderApp();
    await screen.findByText("€3,000"); // both rows counted, so both survived

    await user.click(screen.getByRole("button", { name: "Income" }));
    await user.click(screen.getByText("Freelance"));
    const name = screen.getByDisplayValue("Freelance");
    await user.clear(name);
    await user.type(name, "Consulting");

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Salary")).not.toBeInTheDocument();
  });

  it("keeps rows that arrive with no id at all", async () => {
    served = {
      income: [{ name: "Salary", amount: 1500, frequency: "Monthly" }],
      expenses: [],
      updatedAt: 5,
    };
    await renderApp();
    expect(await screen.findByText("€1,500")).toBeInTheDocument();
  });
});

describe("a plan with absent numbers", () => {
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

  // An amount that went through NaN is written out as null, so a plan holding
  // one is reachable. Number() reads null as 0, which would quietly turn "not
  // recorded" into "explicitly nothing".
  it("does not read a null investment as zero", async () => {
    served = {
      income: [{ id: 1, name: "Salary", amount: 2000, frequency: "Monthly" }],
      expenses: [],
      invest: null,
      updatedAt: 5,
    };
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await screen.findByText("€2,000");
    // The example default (250/mo, so 3,000 a year) is left in place rather
    // than being overwritten with a confident zero.
    expect(screen.getByText("€3,000")).toBeInTheDocument();
  });
});
