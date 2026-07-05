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
    expect(screen.getByText(/Recurring Bills/)).toBeInTheDocument();
    expect(screen.getByText("Category Breakdown")).toBeInTheDocument();
  });

  it("shows per-category set-limit controls", () => {
    render(<App />);
    expect(screen.getAllByText("+ Set limit").length).toBeGreaterThan(0);
  });
});
