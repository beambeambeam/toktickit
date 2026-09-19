import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const password = "correct horse battery staple";

const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

const expectAccessible = async (page: Page, surface: string): Promise<void> => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    `${surface} accessibility violations:\n${JSON.stringify(results.violations, null, 2)}`
  ).toEqual([]);
};

test("passes automated WCAG checks on the anonymous login surface", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expectAccessible(page, "login");
});

test("passes automated WCAG checks on requester surfaces", async ({ page }) => {
  await signIn(page, "e2e-desktop@example.test");
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await expectAccessible(page, "requester ticket list");

  await page.goto("/create");
  await expect(
    page.getByRole("heading", { name: "Create Ticket" })
  ).toBeVisible();
  await expectAccessible(page, "requester create form");
});

test("passes automated WCAG checks on staff operational surfaces", async ({
  page,
}) => {
  await signIn(page, "e2e-staff@example.test");
  await page.goto("/staff/tickets");
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();
  await expectAccessible(page, "staff Ticket Queue");

  const ticketLink = page.getByRole("link", {
    name: "TKT-20260901-NEW001",
  });
  await expect(ticketLink).toBeVisible();
  await ticketLink.click();
  await expect(
    page.getByRole("heading", { name: "Ticket information" })
  ).toBeVisible();
  await expectAccessible(page, "staff Ticket detail");
});

test("passes automated WCAG checks on Administrator user management", async ({
  page,
}) => {
  await signIn(page, "e2e-admin@example.test");
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "User Management" })
  ).toBeVisible();
  await expectAccessible(page, "Administrator user management");
});
