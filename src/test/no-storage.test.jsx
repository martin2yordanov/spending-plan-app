import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Safari in Lockdown Mode, a WebView with site data blocked, a device out of
// disk: localStorage throws on access rather than returning null. Every read
// here happens during a render or a useState initialiser, so one unguarded
// call is a blank app rather than a lost preference.
function breakStorage() {
  const boom = () => { throw new DOMException("The operation is insecure.", "SecurityError"); };
  const broken = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 };
  Object.defineProperty(window, "localStorage", { value: broken, configurable: true });
  return broken;
}

describe("with localStorage throwing on every call", () => {
  let original;

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(window, "localStorage");
    breakStorage();
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
    vi.restoreAllMocks();
  });

  it("still starts", async () => {
    const { default: App } = await import("../App.jsx");
    render(<App />);
    expect(screen.getByText(/Safe to spend|Over budget/)).toBeInTheDocument();
  });

  it("still switches language", async () => {
    const user = userEvent.setup();
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByRole("button", { name: /Български/ }));
    expect(await screen.findByText("Месечен доход")).toBeInTheDocument();
  });

  it("still switches currency", async () => {
    const user = userEvent.setup();
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Currency/ }));
    await user.click(screen.getByRole("button", { name: /USD/ }));
    expect(await screen.findByText(/\$3,500/)).toBeInTheDocument();
  });

  it("still edits an expense", async () => {
    const user = userEvent.setup();
    const { default: App } = await import("../App.jsx");
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Expenses" }));
    await user.click(screen.getByText("Supermarket"));
    expect(screen.getByDisplayValue("Supermarket")).toBeInTheDocument();
  });

  it("still shows the lock gate's decision rather than throwing", async () => {
    const { default: AppLock } = await import("../AppLock.jsx");
    render(<AppLock><div>Plan</div></AppLock>);
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("still renders the error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: ErrorBoundary } = await import("../ErrorBoundary.jsx");
    const Boom = () => { throw new Error("nope"); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
