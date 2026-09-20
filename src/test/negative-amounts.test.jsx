import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@clerk/clerk-react", () => {
  const user = { id: "user_NEW", primaryEmailAddress: { emailAddress: "m@example.com" } };
  const state = { isLoaded: true, isSignedIn: true, user };
  const authState = { getToken: async () => "t" };
  return {
    useUser: () => state,
    useAuth: () => authState,
    UserButton: () => <div data-testid="user-button" />,
    SignInButton: ({ children }) => <>{children}</>,
  };
});

// Nothing stops a negative amount being entered, and it is a reasonable thing
// to enter: a refund, a credit, an overdraft recorded as a balance. A negative
// percentage is not a valid CSS width, so the declaration is dropped and the
// bar falls back to its container's full width — the opposite of the number
// next to it.
describe("a plan containing negative amounts", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "POST") return { ok: true, status: 200, json: async () => ({ ok: true }) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          income: [{ id: 1, name: "Salary", amount: 1000, frequency: "Monthly" }],
          expenses: [
            { id: 1, name: "Rent", category: "Bills", amount: 800, frequency: "Monthly" },
            { id: 2, name: "Refund", category: "Food", amount: -600, frequency: "Monthly" },
          ],
          savingsAccounts: [{ id: 1, name: "Overdrawn", amount: -200, target: 1000 }],
          emergencyMonths: 3,
          updatedAt: 5,
        }),
      };
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
    await screen.findByText("€1,000");
  }

  it("still shows the real figures alongside the clamped bars", async () => {
    await renderApp();
    // The refund is a genuine entry and stays visible as one; only the bar
    // geometry is clamped. barPercent is unit-tested directly in utils.test.js,
    // which is where the clamp itself is pinned down — jsdom silently discards
    // an invalid width, so the DOM cannot testify to it here.
    expect(screen.getAllByText("€200").length).toBeGreaterThan(0); // 800 - 600
  });

  it("keeps the donut's wedges inside one full circle", async () => {
    await renderApp();
    const circles = [...document.querySelectorAll("circle")];
    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      const [drawn, circumference] = c.getAttribute("stroke-dasharray").split(" ").map(Number);
      expect(drawn).toBeGreaterThanOrEqual(0);
      expect(drawn).toBeLessThanOrEqual(circumference + 0.001);
    }
  });
});
