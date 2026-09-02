import { expect, test } from "@playwright/test";

test("opens the TokTickIT application", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "TokTickIT IT Service Desk" })
  ).toBeVisible();
});
