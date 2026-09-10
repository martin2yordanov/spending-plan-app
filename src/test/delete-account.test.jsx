import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const deleteAccount = vi.fn(async () => {});

vi.mock("@clerk/clerk-react", () => {
  const user = {
    id: "user_NEW",
    primaryEmailAddress: { emailAddress: "m@example.com" },
    delete: deleteAccount,
  };
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

async function renderApp() {
  vi.resetModules();
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
  const { default: App } = await import("../App.jsx");
  render(<App />);
}

describe("account deletion (App Store 5.1.1(v))", () => {
  let store, deletes;

  beforeEach(() => {
    deletes = [];
    store = {
      user_NEW: {
        income: [{ id: 1, name: "Salary", amount: 4321, frequency: "Monthly" }],
        expenses: [{ id: 1, name: "Rent", type: "Utilities", category: "Bills", amount: 100, frequency: "Monthly" }],
        updatedAt: 1000,
      },
    };
    global.fetch = vi.fn(async (url, opts) => {
      const id = new URL(url, "http://localhost").searchParams.get("id");
      if (opts?.method === "DELETE") {
        deletes.push(id);
        delete store[id];
        return { ok: true, status: 200, json: async () => ({ ok: true, removed: 1 }) };
      }
      if (opts?.method === "POST") {
        store[id] = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => store[id] ?? null };
    });
    localStorage.setItem("walkthrough_done_user_NEW", "1");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("is reachable from inside the app while signed in", async () => {
    await renderApp();
    expect(await screen.findByText("Delete my account")).toBeInTheDocument();
  });

  it("refuses to delete until the confirmation word is typed exactly", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(await screen.findByText("Delete my account"));

    const button = screen.getByRole("button", { name: "Delete permanently" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("Type DELETE to confirm"), "delete");   // wrong case
    expect(button).toBeDisabled();

    await user.clear(screen.getByLabelText("Type DELETE to confirm"));
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    expect(button).toBeEnabled();
  });

  it("removes the stored plan, the local cache and the Clerk user", async () => {
    const user = userEvent.setup();
    await renderApp();
    await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toBeTruthy());

    await user.click(await screen.findByText("Delete my account"));
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(deletes).toContain("user_NEW"));
    expect(store.user_NEW).toBeUndefined();
    await waitFor(() => expect(localStorage.getItem(CACHE_KEY)).toBeNull());
    // The Clerk account itself goes too — deleting only the plan would leave
    // an account behind and would not satisfy the guideline.
    expect(deleteAccount).toHaveBeenCalled();
  });

  it("deletes the plan before the Clerk user, since deletion ends the session", async () => {
    const user = userEvent.setup();
    const order = [];
    deleteAccount.mockImplementation(async () => { order.push("clerk"); });
    const realFetch = global.fetch;
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "DELETE") order.push("plan");
      return realFetch(url, opts);
    });

    await renderApp();
    await user.click(await screen.findByText("Delete my account"));
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(order).toEqual(["plan", "clerk"]));
  });

  it("surfaces a failure instead of pretending the account is gone", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === "DELETE") return { ok: false, status: 500, json: async () => ({}) };
      const id = new URL(url, "http://localhost").searchParams.get("id");
      return { ok: true, status: 200, json: async () => store[id] ?? null };
    });

    await renderApp();
    await user.click(await screen.findByText("Delete my account"));
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(await screen.findByText(/Could not delete the account/)).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
