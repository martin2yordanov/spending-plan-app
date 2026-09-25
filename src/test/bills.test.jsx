import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

async function openBills(user) {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Bills" }));
}

async function addBill(user, name, amount, day) {
  await user.click(screen.getByRole("button", { name: /Add Bill/ }));
  await user.type(screen.getByPlaceholderText("Bill name"), name);
  await user.type(screen.getByPlaceholderText("0"), amount);
  if (day) await user.selectOptions(screen.getAllByRole("combobox").at(-1), String(day));
  await user.click(screen.getByRole("button", { name: /\+ Add Bill/ }));
}

describe("bills", () => {
  beforeEach(() => vi.setSystemTime(new Date(2026, 2, 10)));
  afterEach(() => vi.useRealTimers());

  it("explains itself when there is nothing yet", async () => {
    const user = userEvent.setup();
    await openBills(user);
    expect(screen.getByText(/No bills yet/)).toBeInTheDocument();
  });

  it("adds one", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Electricity", "70", 20);
    expect(await screen.findByText("Electricity")).toBeInTheDocument();
    expect(screen.getByText(/Day 20 of each month/)).toBeInTheDocument();
    expect(screen.getAllByText("€70").length).toBeGreaterThan(0);
  });

  it("says how far off the next one is", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Rent", "500", 20); // today is the 10th
    expect(await screen.findByText(/Due in 10 days/)).toBeInTheDocument();
  });

  it("takes a comma decimal, like every other amount", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Internet", "35,5", 5);
    expect(await screen.findByText("Internet")).toBeInTheDocument();
    expect(screen.getAllByText("€36").length).toBeGreaterThan(0);
  });

  it("refuses a bill with no name", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await user.click(screen.getByRole("button", { name: /Add Bill/ }));
    await user.type(screen.getByPlaceholderText("0"), "10");
    await user.click(screen.getByRole("button", { name: /\+ Add Bill/ }));
    expect(screen.getByPlaceholderText("Bill name")).toBeInTheDocument(); // form still open
  });

  it("totals them", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Rent", "500", 1);
    await addBill(user, "Internet", "40", 5);
    expect(await screen.findByText("€540")).toBeInTheDocument();
  });

  it("edits one", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Rent", "500", 1);
    await user.click(await screen.findByText("Rent"));
    const name = screen.getByDisplayValue("Rent");
    await user.clear(name);
    await user.type(name, "Mortgage");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Mortgage")).toBeInTheDocument();
  });

  it("deletes one, with the same undo as everything else", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Rent", "500", 1);
    await user.click(await screen.findByText("Rent"));
    await user.click(screen.getByRole("button", { name: /Delete/ }));
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Rent")).toBeInTheDocument();
  });

  // A day-of-month trigger does not fire in a month that has no such day, and
  // saying so beside the field is cheaper than a reminder that never arrives.
  it("warns when the chosen day does not exist every month", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await user.click(screen.getByRole("button", { name: /Add Bill/ }));
    await user.selectOptions(screen.getAllByRole("combobox").at(-1), "31");
    expect(screen.getByText(/Months shorter than this are skipped/)).toBeInTheDocument();
  });

  it("says nothing about short months for a day every month has", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await user.click(screen.getByRole("button", { name: /Add Bill/ }));
    await user.selectOptions(screen.getAllByRole("combobox").at(-1), "15");
    expect(screen.queryByText(/Months shorter than this/)).not.toBeInTheDocument();
  });

  // The web cannot schedule anything; promising a reminder there would be a lie.
  it("says where the reminders are actually set when on the web", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Rent", "500", 1);
    expect(await screen.findByText(/Reminders are scheduled on your iPhone/)).toBeInTheDocument();
  });

  it("appears in the exported report", async () => {
    const user = userEvent.setup();
    await openBills(user);
    await addBill(user, "Council Tax", "120", 12);
    await screen.findByText("Council Tax");
    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByRole("button", { name: /Report/ })).toBeInTheDocument();
  });
});
