import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

async function openExpenses(user) {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Expenses" }));
}

async function renameCategory(user, from, to) {
  // The last match, not the only one: a category can share its name with a
  // tab in the header, and the header comes first in the document.
  const chip = screen.getAllByRole("button", { name: new RegExp(`${from}$`) }).at(-1);
  await user.dblClick(chip);
  const input = screen.getByDisplayValue(from);
  await user.clear(input);
  await user.type(input, `${to}{Enter}`);
}

async function createCategory(user, name, emoji = "🐶") {
  await user.click(screen.getByRole("button", { name: /New Category/ }));
  await user.type(screen.getByPlaceholderText(/[Cc]ategory name/), name);
  await user.click(screen.getByRole("button", { name: emoji }));
  await user.click(screen.getByRole("button", { name: /Create/ }));
}

describe("categories", () => {
  it("renames a built-in category", async () => {
    const user = userEvent.setup();
    await openExpenses(user);
    await renameCategory(user, "Bills", "Utilities");
    expect(screen.getByRole("button", { name: /Utilities$/ })).toBeInTheDocument();
  });

  it("creates a new one", async () => {
    const user = userEvent.setup();
    await openExpenses(user);
    await createCategory(user, "Pets");
    expect(screen.getByRole("button", { name: /Pets$/ })).toBeInTheDocument();
  });

  it("refuses a name that is already on screen", async () => {
    const user = userEvent.setup();
    await openExpenses(user);
    await user.click(screen.getByRole("button", { name: /New Category/ }));
    await user.type(screen.getByPlaceholderText(/[Cc]ategory name/), "food");
    await user.click(screen.getByRole("button", { name: "🐶" }));
    await user.click(screen.getByRole("button", { name: /Create/ }));
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  // The one way past the duplicate-label check: rename a built-in, then create
  // a category with the name it used to have. Keying the new one on the
  // built-in's key would take it over and drop the rename with it.
  it("does not clobber a renamed built-in with a new category of the old name", async () => {
    const user = userEvent.setup();
    await openExpenses(user);
    await renameCategory(user, "Bills", "Utilities");
    await createCategory(user, "Bills", "🏠");

    // Both survive, under their own names.
    expect(screen.getByRole("button", { name: /Utilities$/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Bills$/ }).length).toBeGreaterThan(1); // the tab, and the chip
    // And the renamed one still carries the expenses that were filed under it.
    await user.click(screen.getByRole("button", { name: /Utilities$/ }));
    expect(screen.getByText("Electricity Bill")).toBeInTheDocument();
  });

  it("files a new expense under the category that was just created", async () => {
    const user = userEvent.setup();
    await openExpenses(user);
    await createCategory(user, "Pets");
    await user.click(screen.getAllByRole("button", { name: /Add Expense/ }).at(-1));
    await user.type(screen.getByPlaceholderText("Name"), "Vet");
    await user.click(screen.getByRole("button", { name: /Add Expense/ }));
    // The filter is already on Pets, so the row showing means it was filed there.
    expect(await screen.findByText("Vet")).toBeInTheDocument();
  });
});

describe("the add-expense form and the active filter", () => {
  it("leaves the default alone when nothing is filtered", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Expenses" }));
    await user.click(screen.getAllByRole("button", { name: /Add Expense/ }).at(-1));
    const select = screen.getAllByRole("combobox")[0];
    expect(select).toHaveValue("Personal");
  });

  it("follows the filter when one is on", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Expenses" }));
    await user.click(screen.getByRole("button", { name: /Food$/ }));
    await user.click(screen.getAllByRole("button", { name: /Add Expense/ }).at(-1));
    const select = screen.getAllByRole("combobox")[0];
    expect(select).toHaveValue("Food");
  });
});
