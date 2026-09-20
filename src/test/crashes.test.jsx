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
    await user.click(screen.getByRole("button", { name: "Expenses" }));
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
    await user.click(screen.getByRole("button", { name: "Expenses" }));
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

describe("adding a row from the wide table layout", () => {
  // type="number" rejects a comma outright — the browser blanks the value
  // rather than reporting it — so a European decimal vanished as it was typed.
  it("takes a comma decimal in the new-expense amount", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Expenses" }));
    await user.click(screen.getAllByRole("button", { name: /Add Expense/ }).at(-1));
    await user.type(screen.getByPlaceholderText("Name"), "Coffee");
    const amount = screen.getByPlaceholderText("0");
    await user.type(amount, "45,5");
    expect(amount).toHaveValue("45,5");
    await user.click(screen.getByRole("button", { name: /Add Expense/ }));
    expect(await screen.findByText("Coffee")).toBeInTheDocument();
    // €46 rounded, not €0 and not €455.
    expect(screen.getAllByText("€46").length).toBeGreaterThan(0);
  });

  it("takes a comma decimal in the new-income amount", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Income" }));
    await user.click(screen.getAllByRole("button", { name: /Add Income Source/ }).at(-1));
    await user.type(screen.getByPlaceholderText("Income source"), "Tutoring");
    const amount = screen.getByPlaceholderText("0");
    await user.type(amount, "120,5");
    await user.click(screen.getByRole("button", { name: /Add Income Source/ }));
    expect(await screen.findByText("Tutoring")).toBeInTheDocument();
    expect(screen.getAllByText("€121").length).toBeGreaterThan(0);
  });
});

describe("rows that behave like buttons", () => {
  // These are divs, laid out as cards and rows. Without a role a screen reader
  // announces them as ordinary text with nothing to activate, and there is no
  // way to reach them from a keyboard at all.
  it("announces the Overview cards by their label, not their figures", () => {
    render(<App />);
    const card = screen.getByRole("button", { name: "Monthly Expenses" });
    expect(card).toHaveAttribute("tabindex", "0");
  });

  it("opens a tab from the keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    screen.getByRole("button", { name: "Monthly Income" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Add Income Source/ })).toBeInTheDocument();
  });

  it("opens an expense row from the keyboard", async () => {
    const user = userEvent.setup();
    setViewport(375);
    try {
      render(<App />);
      await user.click(screen.getByRole("button", { name: "Expenses" }));
      screen.getByRole("button", { name: "Supermarket" }).focus();
      await user.keyboard(" ");
      expect(screen.getByDisplayValue("Supermarket")).toBeInTheDocument();
    } finally {
      setViewport(1024);
    }
  });
});

describe("document structure", () => {
  // Every section title was a styled div, so VoiceOver's rotor had no headings
  // to jump between — on a screen this dense that is the difference between
  // navigating and reading every line in order.
  it("gives the screen a heading outline", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: /Spending Plan/ })).toBeInTheDocument();
    for (const name of ["Spending by Category", "Category Breakdown", /Emergency Fund/, /Financial Health Score/]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Savings" }));
    expect(screen.getByRole("heading", { level: 2, name: /Savings/ })).toBeInTheDocument();
  });
});
