import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const shared = { html: null };

vi.mock("../native.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isNative: false,
    shareReport: async (html) => { shared.html = html; return { ok: true }; },
    biometricAvailable: async () => false,
    syncBillReminders: async () => ({ scheduled: 0 }),
  };
});

const { default: App } = await import("../App.jsx");

// The report is assembled by string interpolation and then written to a file
// that goes through the iOS share sheet, so anything the user typed has to
// survive as text rather than becoming markup.
describe("exported report", () => {
  beforeEach(() => { shared.html = null; });

  async function generate() {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /Report/ }));
    return shared.html;
  }

  it("escapes markup typed into an expense name", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Expenses" }));
    await user.click(screen.getByText("Supermarket"));
    const name = screen.getByDisplayValue("Supermarket");
    await user.clear(name);
    await user.type(name, "<script>x</script> & Co");
    await user.click(screen.getByRole("button", { name: "Overview" }));
    await user.click(screen.getByRole("button", { name: /Report/ }));

    expect(shared.html).toBeTruthy();
    expect(shared.html).not.toContain("<script>x</script>");
    expect(shared.html).toContain("&lt;script&gt;x&lt;/script&gt; &amp; Co");
  });

  it("still renders ordinary names and totals", async () => {
    const html = await generate();
    expect(html).toContain("Supermarket");
    expect(html).toContain("Salary");
  });
});
