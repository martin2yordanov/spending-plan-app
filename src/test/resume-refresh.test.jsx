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
const planWith = (amount, updatedAt) => ({
  income: [{ id: 1, name: "Salary", amount, frequency: "Monthly" }],
  expenses: [{ id: 1, name: "Rent", type: "Utilities", category: "Bills", amount: 100, frequency: "Monthly" }],
  emergencyMonths: 3,
  updatedAt,
});

function foreground() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

// A phone left running shows yesterday's figures indefinitely — and the first
// edit made on those stale figures is stamped now, so it wins the next
// comparison and whatever was done on the other device is gone.
describe("returning to the foreground", () => {
  let served;
  let posts;

  beforeEach(async () => {
    posts = [];
    served = planWith(3000, 1000);
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "POST") {
        posts.push(JSON.parse(opts.body));
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => served };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
    localStorage.setItem(CACHE_KEY, JSON.stringify(planWith(3000, 1000)));
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

  it("picks up an edit made on another device", async () => {
    served = planWith(5555, 9999);
    foreground();
    expect(await screen.findByText("€5,555")).toBeInTheDocument();
  });

  it("caches what it picked up, so the next cold start already has it", async () => {
    served = planWith(5555, 9999);
    foreground();
    await screen.findByText("€5,555");
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CACHE_KEY)).income[0].amount).toBe(5555);
    });
  });

  it("ignores a server copy that is not newer", async () => {
    served = planWith(1111, 500);
    foreground();
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.getAllByText("€3,000").length).toBeGreaterThan(0);
    expect(screen.queryByText("€1,111")).not.toBeInTheDocument();
  });

  // The guards are what keep this from being the thing that loses data.
  it("does not overwrite an edit still waiting on the debounce", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "6m" }));
    served = planWith(5555, 9999);
    foreground();
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByText("€5,555")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6m" }).style.background).toBe("rgb(0, 122, 255)");
  });

  it("does not rewrite a row that is open for editing", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Income" }));
    await user.click(screen.getByText("Salary"));
    served = planWith(5555, 9999);
    foreground();
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.getByDisplayValue("3000")).toBeInTheDocument();
  });

  it("does not overwrite an edit that never reached the server", async () => {
    localStorage.setItem("plan_pending_sync", "user_NEW");
    served = planWith(5555, 9999);
    foreground();
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByText("€5,555")).not.toBeInTheDocument();
  });
});
