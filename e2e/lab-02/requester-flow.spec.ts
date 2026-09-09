import { writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const projectSlug = (projectName: string) =>
  projectName.replaceAll(/[^a-z0-9]+/giu, "-").toLowerCase();

const requesterEmailBySlug: Record<string, string> = {
  "desktop-chromium": "e2e-desktop@example.test",
  "mobile-chromium": "e2e-mobile@example.test",
  "tablet-chromium": "e2e-tablet@example.test",
};
const e2ePassword = "correct horse battery staple";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");

const evidencePath = (section: string, name: string) =>
  path.resolve(
    repositoryRoot,
    "artifacts",
    "lab-03",
    "screenshots",
    section,
    name
  );

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

  expect(overflow).toBeLessThanOrEqual(0);
};

const expectPrimaryHeaderToken = async (page: Page) => {
  const backgroundColor = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector(".app-header") ?? document.body)
        .backgroundColor
  );

  expect(backgroundColor).toBe("rgb(0, 107, 60)");
};

const logOut = async (page: Page) => {
  const mobileNavigation = page.locator(".mobile-nav");

  if (await mobileNavigation.isVisible()) {
    await mobileNavigation.locator("summary").click();
    await mobileNavigation.getByRole("button", { name: "Log out" }).click();
    return;
  }

  await page
    .locator(".account-chip")
    .getByRole("button", { name: "Log out" })
    .click();
};

const createDeferred = () => {
  let release!: () => void;
  // oxlint-disable-next-line promise/avoid-new -- Route gate controls a browser loading state.
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, resolve: release };
};

test("captures the requester ticket lifecycle and ownership boundary", async ({
  page,
}, testInfo) => {
  const slug = projectSlug(testInfo.project.name);
  const uniqueId = `${Date.now()}-${testInfo.workerIndex}`;
  const summary = `E2E requester flow ${uniqueId}`;
  const attachmentName = `e2e-evidence-${slug}.png`;
  const requesterEmail =
    requesterEmailBySlug[slug] ?? "e2e-desktop@example.test";
  const isolationEmail = "e2e-isolation@example.test";
  const captured: string[] = [];

  const capture = async (section: string, name: string) => {
    const filePath = evidencePath(section, name);
    await page.screenshot({ fullPage: true, path: filePath });
    captured.push(path.relative(repositoryRoot, filePath));
  };

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to TokTickIT" })
  ).toBeVisible();
  await capture("login", `${slug}-initial.png`);
  await page.getByLabel("Email").fill(requesterEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(e2ePassword);
  await capture("login", `${slug}-filled.png`);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/tickets$/u);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await capture("my-tickets", `${slug}-initial.png`);

  await page.getByRole("button", { name: /Create Ticket/u }).click();
  await expect(
    page.getByRole("heading", { name: "Create Ticket" })
  ).toBeVisible();
  await capture("create-ticket", `${slug}-initial.png`);

  await page
    .getByRole("button", { exact: true, name: "Create Ticket" })
    .click();
  await expect(
    page.getByText("Review the highlighted fields before submitting.")
  ).toBeVisible();
  await capture("create-ticket", `${slug}-validation.png`);

  await page.locator("#attachments").setInputFiles({
    buffer: Buffer.from("not permitted"),
    mimeType: "text/plain",
    name: "notes.txt",
  });
  await expect(
    page.getByText("notes.txt: use JPG, JPEG, PNG, WEBP, or PDF.")
  ).toBeVisible();
  await capture("create-ticket", `${slug}-invalid-attachment.png`);

  await page.locator("#categoryId").selectOption("1");
  await page.locator("#relatedSystemId").selectOption("1");
  await page.getByLabel("Ticket Summary").fill(summary);
  await page.getByLabel("Requested Priority").selectOption("Medium");
  await page
    .getByLabel("Description")
    .fill(
      "The requester flow needs an end-to-end check with a persisted attachment and an ownership boundary."
    );
  await page.locator("#attachments").setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: attachmentName,
  });
  await expect(page.getByText(attachmentName)).toBeVisible();
  await capture("create-ticket", `${slug}-filled.png`);
  await expectNoHorizontalOverflow(page);

  const createRoutePattern = /\/api\/tickets$/u;
  let failNextCreate = true;
  const createFailureRoute = async (route: Route) => {
    if (failNextCreate && route.request().method() === "POST") {
      failNextCreate = false;
      await route.abort("failed");
      return;
    }

    await route.continue();
  };
  await page.route(createRoutePattern, createFailureRoute);
  await page
    .getByRole("button", { exact: true, name: "Create Ticket" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to connect to TokTickIT API"
  );
  await capture("create-ticket", `${slug}-api-failure.png`);
  await page.unroute(createRoutePattern, createFailureRoute);

  const createGate = createDeferred();
  let holdNextCreate = true;
  const createBusyRoute = async (route: Route) => {
    if (holdNextCreate && route.request().method() === "POST") {
      holdNextCreate = false;
      await createGate.promise;
    }

    await route.continue();
  };
  await page.route(createRoutePattern, createBusyRoute);
  await page
    .getByRole("button", { exact: true, name: "Create Ticket" })
    .click();
  await expect(page.getByText("Creating your Ticket…")).toBeVisible();
  await capture("create-ticket", `${slug}-busy.png`);
  createGate.resolve();
  await expect(
    page.getByRole("heading", { name: "Ticket created" })
  ).toBeVisible();
  await page.unroute(createRoutePattern, createBusyRoute);
  const ticketNumber = page.locator(".created-ticket-number strong");
  await expect(ticketNumber).toHaveText(/^TKT-\d{8}-[A-Z0-9]{6}$/u);
  const createdTicketNumber = await ticketNumber.textContent();
  if (createdTicketNumber === null) {
    throw new Error("Created Ticket Number was not rendered.");
  }
  await capture("create-ticket", `${slug}-success.png`);

  await page.getByRole("button", { name: "Go to My Tickets" }).click();
  const createdTicketLink = page.getByRole("link", {
    name: createdTicketNumber,
  });
  await expect(createdTicketLink).toBeVisible();
  const createdTicketHref = await createdTicketLink.getAttribute("href");
  if (createdTicketHref === null) {
    throw new Error("Created Ticket link did not include a detail URL.");
  }
  await capture("my-tickets", `${slug}-owned.png`);
  await expectNoHorizontalOverflow(page);
  await expectPrimaryHeaderToken(page);

  const ticketsRoutePattern = /\/api\/tickets(?:\?.*)?$/u;
  let failListRequests = true;
  const listFailureRoute = async (route: Route) => {
    if (failListRequests && route.request().method() === "GET") {
      await route.abort("failed");
      return;
    }

    await route.continue();
  };
  await page.route(ticketsRoutePattern, listFailureRoute);
  await page.reload();
  await expect(page.getByText("Could not load My Tickets.")).toBeVisible();
  await capture("my-tickets", `${slug}-failure.png`);
  failListRequests = false;
  await page.unroute(ticketsRoutePattern, listFailureRoute);
  await page.getByRole("button", { exact: true, name: "Retry" }).click();
  await expect(createdTicketLink).toBeVisible();

  const listGate = createDeferred();
  let holdNextList = true;
  const listLoadingRoute = async (route: Route) => {
    if (holdNextList && route.request().method() === "GET") {
      holdNextList = false;
      await listGate.promise;
    }

    await route.continue();
  };
  await page.route(ticketsRoutePattern, listLoadingRoute);
  const reloadPromise = page.reload();
  await expect(page.getByText("Loading your Tickets…")).toBeVisible();
  await capture("my-tickets", `${slug}-loading.png`);
  listGate.resolve();
  await reloadPromise;
  await expect(createdTicketLink).toBeVisible();
  await page.unroute(ticketsRoutePattern, listLoadingRoute);

  const categoriesRoutePattern = /\/api\/categories$/u;
  let failCategoryRequests = true;
  const categoryFailureRoute = async (route: Route) => {
    if (failCategoryRequests && route.request().method() === "GET") {
      await route.abort("failed");
      return;
    }

    await route.continue();
  };
  await page.route(categoriesRoutePattern, categoryFailureRoute);
  await page.reload();
  await expect(
    page.getByText("Some filter options are unavailable.")
  ).toBeVisible();
  await capture("my-tickets", `${slug}-filter-failure.png`);
  failCategoryRequests = false;
  await page.unroute(categoriesRoutePattern, categoryFailureRoute);
  await page.getByRole("button", { name: "Retry filter options" }).click();
  await expect(page.locator("#ticket-category-filter")).toContainText(
    "Account and Access"
  );

  await page.getByLabel("Search").fill(`no-results-${uniqueId}`);
  await page.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(page.getByText("No matching Tickets")).toBeVisible();
  await capture("my-tickets", `${slug}-no-results.png`);
  await page
    .getByRole("button", { exact: true, name: "Clear Filters" })
    .click();
  await expect(
    page.getByRole("link", { name: createdTicketNumber })
  ).toBeVisible();

  await page.getByRole("link", { name: createdTicketNumber }).click();
  await expect(
    page.getByRole("heading", { name: "Ticket Detail" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: attachmentName })
  ).toBeVisible();
  const attachmentRow = page
    .locator(".attachment-item")
    .filter({ hasText: attachmentName });
  await expect(attachmentRow.locator(".state-label")).toHaveText(/Active/u);
  await capture("ticket-detail", `${slug}-active.png`);
  await expectNoHorizontalOverflow(page);

  await page.locator("#attachments").setInputFiles({
    buffer: Buffer.from("not permitted"),
    mimeType: "text/plain",
    name: "notes.txt",
  });
  await expect(
    page.getByText("notes.txt: use JPG, JPEG, PNG, WEBP, or PDF.")
  ).toBeVisible();
  await capture("ticket-detail", `${slug}-invalid-attachment.png`);

  const additionalAttachmentName = `additional-evidence-${slug}.png`;
  await page.locator("#attachments").setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: additionalAttachmentName,
  });
  const uploadGate = createDeferred();
  let holdNextUpload = true;
  const uploadRoutePattern = /\/api\/tickets\/\d+\/attachments$/u;
  const uploadRoute = async (route: Route) => {
    if (holdNextUpload && route.request().method() === "POST") {
      holdNextUpload = false;
      await uploadGate.promise;
    }

    await route.continue();
  };
  await page.route(uploadRoutePattern, uploadRoute);
  await page.getByRole("button", { name: "Add Attachment(s)" }).click();
  await expect(page.getByRole("button", { name: "Uploading…" })).toBeVisible();
  await capture("ticket-detail", `${slug}-uploading.png`);
  uploadGate.resolve();
  await expect(
    page.getByText("Attachment(s) added successfully.")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: additionalAttachmentName })
  ).toBeVisible();
  await capture("ticket-detail", `${slug}-uploaded.png`);
  await page.unroute(uploadRoutePattern, uploadRoute);

  const attachmentContentRequestPromise = page.waitForRequest((request) =>
    /\/api\/tickets\/\d+\/attachments\/\d+\/content$/u.test(
      new URL(request.url()).pathname
    )
  );
  const downloadPromise = page.waitForEvent("download");
  await attachmentRow.getByRole("button", { name: "Download" }).click();
  const [attachmentContentRequest, download] = await Promise.all([
    attachmentContentRequestPromise,
    downloadPromise,
  ]);
  expect(download.suggestedFilename()).toBe(attachmentName);
  const attachmentContentUrl = attachmentContentRequest.url();

  await attachmentRow.getByRole("button", { name: "Remove" }).click();
  const removalDialog = page.getByRole("alertdialog");
  await expect(removalDialog).toBeVisible();
  await capture("ticket-detail", `${slug}-removal-confirmation.png`);
  await removalDialog
    .getByLabel("Removal reason")
    .fill("Duplicate evidence file");
  await removalDialog.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    page.getByText(
      "Attachment removed. Its metadata remains in the Ticket history."
    )
  ).toBeVisible();
  await expect(attachmentRow.locator(".state-label")).toHaveText(/Removed/u);
  const removedDownloadResponse = await page.request.get(attachmentContentUrl);
  expect(removedDownloadResponse.status()).toBe(404);
  await capture("ticket-detail", `${slug}-removed.png`);

  await logOut(page);
  await expect(page).toHaveURL(/\/login$/u);
  await page.getByLabel("Email").fill(isolationEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(e2ePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/tickets$/u);
  await expect(page.getByText("No Tickets yet")).toBeVisible();
  await expect(
    page.getByRole("link", { name: createdTicketNumber })
  ).toHaveCount(0);
  await capture("my-tickets", `${slug}-empty.png`);

  await capture("my-tickets", `${slug}-ownership.png`);

  await page.goto(createdTicketHref);
  await expect(
    page.getByRole("heading", { name: "Ticket unavailable" })
  ).toBeVisible();
  await expect(page.getByText("Ticket was not found.")).toBeVisible();
  await capture("ticket-detail", `${slug}-unauthorized.png`);

  await writeFile(
    path.resolve(
      repositoryRoot,
      "artifacts",
      "lab-03",
      "screenshots",
      `manifest-${slug}.json`
    ),
    `${JSON.stringify(
      {
        files: captured,
        generatedAt: new Date().toISOString(),
        project: testInfo.project.name,
      },
      null,
      2
    )}\n`
  );
});
