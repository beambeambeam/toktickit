import { expect, test } from "@playwright/test";

import { captureLab3Evidence } from "./evidence.js";

const staffEmail = "e2e-staff@example.test";
const staffPassword = "correct horse battery staple";
const workflowTicketNumber = "TKT-20260901-RES001";

test("progresses and reopens a Ticket through the staff workflow", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/staff\/tickets$/u);
  const queue = page.locator(
    ".ticket-table-wrap:visible, .ticket-cards:visible"
  );
  const ticket = queue
    .locator("tr, .ticket-card")
    .filter({ hasText: workflowTicketNumber })
    .first();
  await ticket.getByRole("link", { name: workflowTicketNumber }).click();
  await expect(
    page.getByRole("heading", { name: "Progress Ticket" })
  ).toBeVisible();

  const statusSelect = page.getByLabel("Next status");
  const statusLine = page.locator(".required-note").filter({
    hasText: "Current status:",
  });
  const currentStatus = async () => {
    const text = await statusLine.textContent();
    const status = text?.match(/Current status: (?<status>[^·]+)/u)?.groups
      ?.status;
    if (status === undefined) {
      throw new Error(`Unable to read current Ticket status from ${text}`);
    }

    return status.trim();
  };

  const applyStatus = async (status: string) => {
    await statusSelect.selectOption(status);
    await page.getByRole("button", { name: "Apply Status" }).click();

    if (["Resolved", "Closed", "Cancelled"].includes(status)) {
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("button", { name: `Confirm ${status}` }).click();
    }

    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Ticket status changed to ${status}.` })
    ).toBeVisible();
  };

  let status = await currentStatus();
  if (status === "Resolved") {
    await applyStatus("Reopened");
    status = "Reopened";
  }
  if (status === "New") {
    await applyStatus("Open");
    status = "Open";
  }
  if (status === "Reopened" || status === "Waiting for Requester") {
    await applyStatus("In Progress");
    status = "In Progress";
  }
  if (status === "Open") {
    await applyStatus("In Progress");
    status = "In Progress";
  }

  expect(status).toBe("In Progress");
  await statusSelect.selectOption("Resolved");
  await page.getByRole("button", { name: "Apply Status" }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  const cancel = confirmation.getByRole("button", { name: "Cancel" });
  const confirmResolved = confirmation.getByRole("button", {
    name: "Confirm Resolved",
  });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirmResolved).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await captureLab3Evidence(page, testInfo, {
    directory: "accessibility",
    name: "status-confirmation-keyboard.png",
    role: "IT Staff",
    scenario: "Status confirmation focus trap",
    stateSource: "natural",
  });
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply Status" })
  ).toBeFocused();

  await statusSelect.selectOption("Resolved");
  await applyStatus("Resolved");
  await expect(statusLine).toContainText("Current status: Resolved");
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-ticket-detail",
    name: "workflow-resolved.png",
    role: "IT Staff",
    scenario: "Resolved staff workflow",
    stateSource: "natural",
  });
});
