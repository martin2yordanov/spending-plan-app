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

const planWith = (emergencyMonths, updatedAt) => ({
  income: [{ id: 1, name: "Salary", amount: 3000, frequency: "Monthly" }],
  expenses: [{ id: 1, name: "Rent", type: "Utilities", category: "Bills", amount: 100, frequency: "Monthly" }],
  emergencyMonths,
  updatedAt,
});

// The cached plan paints and the app becomes editable well before a cellular
// round trip finishes. Anything typed in that window is newer than either
// stored copy.
describe("an edit made while the server reply is in flight", () => {
  let releaseServer;

  beforeEach(() => {
    localStorage.setItem("walkthrough_done_user_NEW", "1");
    localStorage.setItem(CACHE_KEY, JSON.stringify(planWith(3, 1000)));
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "POST") return { ok: true, status: 200, json: async () => ({ ok: true }) };
      // GET hangs until the test lets it answer.
      await new Promise((resolve) => { releaseServer = resolve; });
      return { ok: true, status: 200, json: async () => planWith(12, 9999) };
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("survives the reply landing afterwards", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    const { default: App } = await import("../App.jsx");
    render(<App />);

    // Cached plan is on screen; the GET has not answered yet.
    await screen.findByText("€3,000");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "6m" }));

    // Now the server answers, with a copy that is newer by timestamp and says
    // 12 months. Adopting it would silently discard the tap just made.
    releaseServer();

    await waitFor(() => {
      const twelve = screen.getByRole("button", { name: "12m" });
      expect(twelve).toBeInTheDocument();
    });
    // 6m stays selected (white on blue); 12m does not become the selection.
    const six = screen.getByRole("button", { name: "6m" });
    expect(six.style.background).toBe("rgb(0, 122, 255)");
    expect(screen.getByRole("button", { name: "12m" }).style.background).not.toBe("rgb(0, 122, 255)");
  });
});
