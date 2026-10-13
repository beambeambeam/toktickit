import type { Page } from "@playwright/test";

// Stale E2E Tickets fill page 1 of the newest-first staff queue. Seeded Tickets
// are therefore located through the queue Search box before any link lookup.
export const searchStaffQueue = async (
  page: Page,
  ticketNumber: string
): Promise<void> => {
  await page
    .getByRole("searchbox", { exact: true, name: "Search" })
    .fill(ticketNumber);
  await page.getByRole("button", { exact: true, name: "Search" }).click();
};
