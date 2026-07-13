import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App.jsx";

// Rendering App exercises the hook declaration order (guards against TDZ
// regressions in useEffect/useCallback dependency arrays) and the new
// Overview cards. Logged out (no Clerk key in tests), so example data shows.
describe("App smoke test", () => {
  it("renders the Overview tab without crashing", () => {
    render(<App />);
    expect(screen.getByText(/Safe to spend/)).toBeInTheDocument();
    expect(screen.getByText("Category Breakdown")).toBeInTheDocument();
  });

  it("no longer shows the removed Recurring Bills card", () => {
    render(<App />);
    expect(screen.queryByText(/Recurring Bills/)).not.toBeInTheDocument();
  });

  it("navigates to the Savings tab when the Net Savings card is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<App />);
    // The card's onClick lives on an ancestor div; clicking the label text
    // bubbles up to it same as a real click anywhere on the card would.
    await userEvent.click(screen.getByText(/Net Savings|Deficit/));
    expect(screen.getByText("Add Savings Account")).toBeInTheDocument();
  });

  it("shows per-category set-limit controls", () => {
    render(<App />);
    expect(screen.getAllByText("+ Set limit").length).toBeGreaterThan(0);
  });
});
