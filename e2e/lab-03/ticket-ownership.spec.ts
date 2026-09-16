import { expect, test } from "@playwright/test";

const staffEmail = "e2e-staff@example.test";
const staffPassword = "correct horse battery staple";

test("claims a Ticket and sets its independent IT Priority", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/staff\/tickets$/u);
  const visibleQueue = page.locator(
    ".ticket-table-wrap:visible, .ticket-cards:visible"
  );
  const visibleTicket = visibleQueue
    .locator("tr, .ticket-card")
    .filter({ hasText: "TKT-20260901-NEW001" })
    .first();

  await visibleTicket
    .getByRole("link", { name: "TKT-20260901-NEW001" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operational controls" })
  ).toBeVisible();

  const owner = page.getByLabel("Ticket Owner");
  if ((await owner.inputValue()) !== "") {
    await owner.selectOption("");
    await page.getByRole("button", { name: "Save Owner" }).click();
    await expect(
      page.getByRole("status").filter({
        hasText: "Ticket Owner saved successfully.",
      })
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Claim Ticket" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Ticket claimed successfully." })
  ).toBeVisible();

  await page.getByLabel("IT Priority").selectOption("Urgent");
  await page.getByRole("button", { name: "Save IT Priority" }).click();
  await expect(
    page.getByRole("status").filter({
      hasText: "IT Priority saved successfully.",
    })
  ).toBeVisible();
  await expect(page.getByLabel("IT Priority")).toHaveValue("Urgent");
});
