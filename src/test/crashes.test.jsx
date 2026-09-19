import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

// Interactions that used to throw a ReferenceError mid-render. In a browser
// that only logs to the console; inside a WKWebView it unmounts the tree and
// the user is left staring at a blank white app with no way back but a force
// quit. Each of these is a plain tap on a control that is always visible.

function setViewport(width) {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
}

describe("crash regressions", () => {
  afterEach(() => setViewport(1024));

  it("opens the investment-type dropdown on Overview", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /S&P 500 ETF/ }));
    expect(screen.getByRole("button", { name: "Crypto" })).toBeInTheDocument();
  });

  it("picks an investment type from the dropdown", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /S&P 500 ETF/ }));
    await user.click(screen.getByRole("button", { name: "Crypto" }));
    expect(screen.getByRole("button", { name: /Crypto/ })).toBeInTheDocument();
  });

  it("opens the category breakdown sheet", async () => {
    const user = userEvent.setup();
    render(<App />);
    // The breakdown rows carry the per-category spend; clicking one opens the
    // sheet listing that category's individual expenses.
    await user.click(screen.getByText("\u{1F476} Child"));
    expect(await screen.findByText("Trip to Burgas – Petrol")).toBeInTheDocument();
  });
});

describe("amount entry stays numeric", () => {
  beforeEach(() => setViewport(375));
  afterEach(() => setViewport(1024));

  it("adds a mobile expense with a numeric amount", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Expenses/ }));
    await user.click(screen.getByRole("button", { name: /^\+ Add Expense$/ }));
    await user.type(screen.getByPlaceholderText("Name"), "Coffee");
    const amount = screen.getAllByPlaceholderText("0")[0];
    await user.type(amount, "50");
    await user.click(screen.getByRole("button", { name: /\+ Add Expense/ }));

    // A string amount survives freqToMonthly("Monthly") untouched and then
    // turns the running total into string concatenation.
    const total = screen.getByText("Total Expenses").parentElement.textContent;
    expect(total).not.toMatch(/\d{6,}/);
  });
});

describe("editing an amount in the desktop table", () => {
  it("keeps every character typed into the amount field", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Expenses/ }));
    const row = screen.getByText("Supermarket").closest("div").parentElement;
    const amountCell = within(row).getByText("€400");
    await user.click(amountCell);
    const input = within(row).getByDisplayValue("400");
    await user.clear(input);
    await user.type(input, "123");
    // A ref callback that re-focuses and re-selects on every render swallows
    // all but the last keystroke.
    expect(input).toHaveValue("123");
  });
});
