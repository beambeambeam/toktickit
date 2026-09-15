import { expect, test } from "@playwright/test";

const staffEmail = "e2e-staff@example.test";
const staffPassword = "correct horse battery staple";

test("browses the shared queue and opens a read-only Ticket detail", async ({
  page,
}) => {
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
  await expect(visibleTicket.getByText("Unassigned")).toBeVisible();

  await visibleTicket
    .getByRole("link", { name: "TKT-20260901-NEW001" })
    .click();

  await expect(page).toHaveURL(/\/tickets\/\d+$/u);
  await expect(
    page.getByRole("heading", { name: "Ticket information" })
  ).toBeVisible();
  await expect(page.getByText("IT Priority")).toBeVisible();
  await expect(page.getByText("Ticket Owner")).toBeVisible();
  await expect(page.getByText("New campus Wi-Fi request")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Add Attachment|Upload/u })
  ).toHaveCount(0);
});
