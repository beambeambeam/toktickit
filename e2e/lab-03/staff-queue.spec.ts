import { expect, test } from "@playwright/test";

import { captureLab3Evidence } from "./evidence.js";

const staffEmail = "e2e-staff@example.test";
const staffPassword = "correct horse battery staple";

test("browses the shared queue and opens a read-only Ticket detail", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/staff\/tickets$/u);
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();
  const visibleQueue = page.locator(
    ".ticket-table-wrap:visible, .ticket-cards:visible"
  );
  const visibleTicket = visibleQueue
    .locator("tr, .ticket-card")
    .filter({ hasText: "TKT-20260901-NEW001" })
    .first();
  await expect(visibleTicket.getByText("TKT-20260901-NEW001")).toBeVisible();
  await expect(
    visibleTicket.getByText("New campus Wi-Fi request")
  ).toBeVisible();

  await visibleTicket
    .getByRole("link", { name: "TKT-20260901-NEW001" })
    .click();

  await expect(page).toHaveURL(/\/tickets\/\d+$/u);
  await expect(
    page.getByRole("heading", { name: "Ticket information" })
  ).toBeVisible();
  const owner = page.getByLabel("Ticket Owner");
  if ((await owner.inputValue()) !== "") {
    await owner.selectOption("");
    await page.getByRole("button", { name: "Save Owner" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Ticket Owner saved successfully." })
    ).toBeVisible();
  }
  const priority = page.getByLabel("IT Priority");
  if ((await priority.inputValue()) !== "Low") {
    await priority.selectOption("Low");
    await page.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "IT Priority saved successfully." })
    ).toBeVisible();
  }

  await page.goto("/staff/tickets");
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();
  const resetQueue = page.locator(
    ".ticket-table-wrap:visible, .ticket-cards:visible"
  );
  const resetTicket = resetQueue
    .locator("tr, .ticket-card")
    .filter({ hasText: "TKT-20260901-NEW001" })
    .first();
  await expect(resetTicket.getByText("Unassigned")).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-queue",
    name: "populated.png",
    role: "IT Staff",
    scenario: "Populated shared Ticket Queue after fixture normalization",
    stateSource: "normalized",
  });

  await resetTicket.getByRole("link", { name: "TKT-20260901-NEW001" }).click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/u);
  await expect(
    page.getByRole("heading", { name: "Ticket information" })
  ).toBeVisible();
  const ticketInformation = page.getByRole("region").filter({
    has: page.getByRole("heading", { name: "Ticket information" }),
  });
  await expect(
    ticketInformation.getByText("IT Priority", { exact: true })
  ).toBeVisible();
  await expect(
    ticketInformation.getByText("Ticket Owner", { exact: true })
  ).toBeVisible();
  await expect(
    ticketInformation.getByText("New campus Wi-Fi request", { exact: true })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-ticket-detail",
    name: "read-only.png",
    role: "IT Staff",
    scenario: "Read-only staff Ticket detail after fixture normalization",
    stateSource: "normalized",
  });
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Add Attachment|Upload/u })
  ).toHaveCount(0);
});
