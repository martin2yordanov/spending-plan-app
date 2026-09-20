import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../ErrorBoundary.jsx";

function Boom() {
  throw new Error("money is not defined");
}

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders its children when nothing is wrong", () => {
    render(<ErrorBoundary><div>Monthly Income</div></ErrorBoundary>);
    expect(screen.getByText("Monthly Income")).toBeInTheDocument();
  });

  // Without this, a render-time throw leaves a white rectangle. A WebView has
  // no reload button, no address bar and no console — the only way out is to
  // force-quit, and nothing tells the user that.
  it("catches a render-time throw and offers a way out", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();
  });

  // The first thing anyone assumes when a budgeting app goes blank.
  it("says the plan is not lost", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/nothing has been lost/i)).toBeInTheDocument();
  });

  it("keeps the message available for a bug report", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText(/money is not defined/)).toBeInTheDocument();
  });

  it("reloads when Restart is pressed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    const original = window.location;
    delete window.location;
    window.location = { ...original, reload };

    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    await userEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(reload).toHaveBeenCalled();

    window.location = original;
  });
});
