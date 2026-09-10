import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Reference-stable, or AuthBridge's effect re-fires every render and locks up
// the event loop (see import.test.jsx).
vi.mock("@clerk/clerk-react", () => {
  const user = { id: "user_NEW", primaryEmailAddress: { emailAddress: "m@example.com" } };
  const state = { isLoaded: true, isSignedIn: true, user };
  return {
    useUser: () => state,
    UserButton: () => <div data-testid="user-button" />,
    SignInButton: ({ children }) => <>{children}</>,
  };
});

const CACHE_KEY = "plan_cache_user_NEW";

const planWith = (name, amount, updatedAt) => ({
  income: [{ id: 1, name, amount, frequency: "Monthly" }],
  expenses: [{ id: 1, name: "Rent", type: "Utilities", category: "Bills", amount: 100, frequency: "Monthly" }],
  updatedAt,
});

async function renderApp() {
  vi.resetModules();
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
  const { default: App } = await import("../App.jsx");
  render(<App />);
}

describe("offline-first cache", () => {
  let store, posts;

  beforeEach(() => {
    store = {};
    posts = [];
    global.fetch = vi.fn(async (url, opts) => {
      const id = new URL(url, "http://localhost").searchParams.get("id");
      if (opts?.method === "POST") {
        const body = JSON.parse(opts.body);
        posts.push({ id, body });
        store[id] = body;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => store[id] ?? null };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("renders the cached plan when the server is unreachable", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(planWith("Cached Salary", 4321, 1000)));
    global.fetch = vi.fn(async () => { throw new Error("offline"); });

    await renderApp();

    // Monthly Income on the overview reflects the cached plan, not example data.
    expect(await screen.findByText("€4,321")).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load your data/)).not.toBeInTheDocument();
  });

  it("keeps the local copy and pushes it when it is newer than the server", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(planWith("Local Newer", 999, 5000)));
    store.user_NEW = planWith("Server Older", 111, 1000);

    await renderApp();

    expect(await screen.findByText("€999")).toBeInTheDocument();
    // The offline edit is uploaded rather than silently discarded.
    await waitFor(() => {
      expect(posts.some((p) => JSON.stringify(p.body).includes("Local Newer"))).toBe(true);
    });
    expect(screen.queryByText("€111")).not.toBeInTheDocument();
  });

  it("takes the server copy when it is newer than the cache", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(planWith("Local Older", 111, 1000)));
    store.user_NEW = planWith("Server Newer", 999, 5000);

    await renderApp();

    expect(await screen.findByText("€999")).toBeInTheDocument();
    expect(screen.queryByText("€111")).not.toBeInTheDocument();
    // ...and the cache is refreshed so the next cold start is already correct.
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CACHE_KEY)).income[0].name).toBe("Server Newer");
    });
  });

  it("caches what the server returns so a later offline start has it", async () => {
    store.user_NEW = planWith("From Server", 2500, 7000);

    await renderApp();

    expect(await screen.findByText("€2,500")).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(CACHE_KEY)).toBeTruthy();
    });
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)).income[0].name).toBe("From Server");
  });

  it("stamps every write with updatedAt so the two sides stay comparable", async () => {
    store.user_NEW = planWith("Server", 3210, 1);   // distinct from the expense amount
    await renderApp();
    await screen.findByText("€3,210");
    // The seed/migration paths also POST; whatever posts, must be stamped.
    for (const p of posts) expect(typeof p.body.updatedAt).toBe("number");
  });
});
