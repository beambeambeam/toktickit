import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const password = "correct horse battery staple";
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const screenshotsRoot = path.resolve(
  repositoryRoot,
  "artifacts",
  "lab-04",
  "screenshots",
  "actions-taken",
  "lifecycle"
);
const evidenceCommand =
  "pnpm --filter @toktickit/e2e exec playwright test lab-04/action-lifecycle.spec.ts";
const styleReviewLink = "docs/lab-04/tests.md#style-01";
const visualReviewLink = "docs/lab-04/tests.md#vis-01";
const screenshotManifest = new Map<string, EvidenceManifest>();
type JsonObject = Record<string, unknown>;

type ViewportName = "desktop" | "tablet" | "mobile";
type ZoomMode =
  | "default"
  | "minimum-width-320-css-pixels"
  | "css-reflow-200-percent"
  | "native-page-scale-200-percent";

interface ViewportSpec {
  height: number;
  name: ViewportName;
  width: number;
}

interface CaptureRecord {
  capturedAt: string;
  path: string;
  role: string;
  review: { style: string; visual: string };
  scenario: string;
  stateSource: "natural";
  viewport: ViewportSpec;
  zoom: { mode: ZoomMode; result: string };
}

interface EvidenceManifest {
  branch: string;
  command: string;
  commit: string;
  files: CaptureRecord[];
  generatedAt: string;
  project: string;
  sourceDirty: boolean;
}

interface CaptureOptions {
  file: string;
  role: string;
  scenario: string;
  zoom?: { mode: ZoomMode; result: string };
}

const viewportByProject = new Map<string, ViewportSpec>([
  ["desktop-chromium", { height: 900, name: "desktop", width: 1440 }],
  ["tablet-chromium", { height: 1024, name: "tablet", width: 768 }],
  ["mobile-chromium", { height: 844, name: "mobile", width: 390 }],
]);

const repositoryValue = (args: readonly string[]): string =>
  execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown, label: string): JsonObject => {
  if (!isRecord(value)) {
    throw new TypeError(`Expected ${label} to be an object.`);
  }
  return value;
};

const viewportForProject = (projectName: string): ViewportSpec => {
  const viewport = viewportByProject.get(projectName);
  if (viewport === undefined) {
    throw new Error(`Unsupported evidence project: ${projectName}`);
  }
  return viewport;
};

const manifestPath = (projectName: string): string =>
  path.resolve(
    screenshotsRoot,
    `manifest-${viewportForProject(projectName).name}.json`
  );

const createManifest = (projectName: string): EvidenceManifest => ({
  branch: repositoryValue(["branch", "--show-current"]),
  command: evidenceCommand,
  commit: repositoryValue(["rev-parse", "HEAD"]),
  files: [],
  generatedAt: new Date().toISOString(),
  project: projectName,
  sourceDirty:
    repositoryValue([
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      ":(exclude)artifacts/lab-04/screenshots/**",
      ":(exclude)e2e/test-results/**",
      ":(exclude)e2e/playwright-report/**",
    ]).length > 0,
});

const writeManifest = async (
  projectName: string,
  manifest: EvidenceManifest
): Promise<void> => {
  await writeFile(
    manifestPath(projectName),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
};

const resetManifest = async (projectName: string): Promise<void> => {
  await mkdir(screenshotsRoot, { recursive: true });
  const manifest = createManifest(projectName);
  screenshotManifest.set(projectName, manifest);
  await writeManifest(projectName, manifest);
};

const capture = async (
  page: Page,
  testInfo: TestInfo,
  options: CaptureOptions
): Promise<void> => {
  const viewport = viewportForProject(testInfo.project.name);
  const currentSize = page.viewportSize();
  const actualViewport = {
    height: currentSize?.height ?? viewport.height,
    name: viewport.name,
    width: currentSize?.width ?? viewport.width,
  };
  const filePath = path.resolve(
    screenshotsRoot,
    `${options.file}-${viewport.name}.png`
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({ fullPage: true, path: filePath });

  let manifest = screenshotManifest.get(testInfo.project.name);
  if (manifest === undefined) {
    manifest = createManifest(testInfo.project.name);
    screenshotManifest.set(testInfo.project.name, manifest);
  }
  const relativePath = path.relative(repositoryRoot, filePath);
  const record: CaptureRecord = {
    capturedAt: new Date().toISOString(),
    path: relativePath,
    review: { style: styleReviewLink, visual: visualReviewLink },
    role: options.role,
    scenario: options.scenario,
    stateSource: "natural",
    viewport: actualViewport,
    zoom: {
      mode: options.zoom?.mode ?? "default",
      result:
        options.zoom?.result ??
        `Default project viewport ${actualViewport.width}×${actualViewport.height}; visualViewport.scale=${await page.evaluate(() => visualViewport?.scale ?? 1)}`,
    },
  };
  const existingIndex = manifest.files.findIndex(
    (file) => file.path === relativePath
  );
  if (existingIndex === -1) {
    manifest.files.push(record);
  } else {
    manifest.files[existingIndex] = record;
  }
  await writeManifest(testInfo.project.name, manifest);
};

const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

const logOut = async (page: Page): Promise<void> => {
  const mobileNavigation = page.locator(".mobile-nav");
  if (await mobileNavigation.isVisible()) {
    await mobileNavigation.locator("summary").click();
    await mobileNavigation.getByRole("button", { name: "Log out" }).click();
  } else {
    await page
      .locator(".account-chip")
      .getByRole("button", { name: "Log out" })
      .click();
  }
  await expect(page).toHaveURL(/\/login$/u);
};

const createTicket = async (
  page: Page,
  testInfo: TestInfo
): Promise<number> => {
  await signIn(page, "e2e-desktop@example.test");
  const sessionResponse = await page.request.get(`${apiUrl}/api/auth/me`);
  expect(sessionResponse.status()).toBe(200);
  const sessionBody = asRecord(
    await sessionResponse.json(),
    "session response"
  );
  const { csrfToken } = sessionBody;
  if (typeof csrfToken !== "string") {
    throw new TypeError("Expected a CSRF token.");
  }
  const response = await page.request.post(`${apiUrl}/api/tickets`, {
    headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
    multipart: {
      categoryId: "1",
      description: "Ticket for the Action Taken lifecycle browser flow.",
      relatedSystemId: "1",
      requestedPriority: "Low",
      summary: `E2E action lifecycle ${testInfo.project.name} ${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const responseBody = asRecord(await response.json(), "Ticket response");
  const ticket = asRecord(responseBody.ticket, "created Ticket");
  const ticketId = ticket.id;
  if (typeof ticketId !== "number") {
    throw new TypeError("Expected a Ticket ID.");
  }
  await logOut(page);
  return ticketId;
};

const actionSection = (page: Page) =>
  page.getByRole("region", { name: "Actions Taken" });

const actionCardByDescription = (page: Page, description: string) =>
  actionSection(page)
    .getByRole("listitem")
    .filter({ hasText: description })
    .first();

const actionIdFromCard = async (
  card: ReturnType<typeof actionCardByDescription>
): Promise<number> => {
  const heading = card.getByRole("heading", {
    exact: true,
    name: /^Action Taken #\d+$/u,
  });
  await expect(heading).toBeVisible();
  const text = (await heading.textContent()) ?? "";
  const actionId = /^Action Taken #(?<id>\d+)$/u.exec(text)?.groups?.id;
  if (actionId === undefined) {
    throw new TypeError(`Could not read Action Taken ID from ${text}.`);
  }
  return Number(actionId);
};

const checkLayoutAndAccessibility = async (page: Page): Promise<void> => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
};

const checkResponsiveWidths = async (
  page: Page,
  testInfo: TestInfo,
  role: string
): Promise<void> => {
  const originalViewport = page.viewportSize();
  if (originalViewport === null) {
    throw new Error("Responsive checks require a fixed viewport.");
  }

  await page.setViewportSize({ height: 844, width: 320 });
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    file: "action-lifecycle-minimum-width-320-css-pixels",
    role,
    scenario: "Action lifecycle at 320 CSS pixels",
    zoom: {
      mode: "minimum-width-320-css-pixels",
      result: "320 CSS-pixel check passed with no page overflow",
    },
  });

  await page.setViewportSize({ height: 450, width: 720 });
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    file: "action-lifecycle-css-reflow-200-percent",
    role,
    scenario: "Action lifecycle at the 200% CSS reflow proxy",
    zoom: {
      mode: "css-reflow-200-percent",
      result: "720 CSS-pixel reflow check passed with no page overflow",
    },
  });
  await page.setViewportSize(originalViewport);
};

const checkNativePageScale = async (
  page: Page,
  testInfo: TestInfo,
  role: string
): Promise<void> => {
  if (testInfo.project.name !== "desktop-chromium") {
    return;
  }
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await expect
      .poll(async () => await page.evaluate(() => visualViewport?.scale))
      .toBe(2);
    await checkLayoutAndAccessibility(page);
    await capture(page, testInfo, {
      file: "action-lifecycle-native-page-scale-200-percent",
      role,
      scenario: "Action lifecycle at 200% native page scale",
      zoom: {
        mode: "native-page-scale-200-percent",
        result: "Native page scale 2 passed without horizontal overflow",
      },
    });
  } finally {
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await session.detach();
  }
};

test.beforeAll(async ({ browserName }, workerInfo) => {
  expect(browserName).toBe("chromium");
  await resetManifest(workerInfo.project.name);
});

test("staff create, assign, start, complete, and cancel Actions Taken", async ({
  page,
}, testInfo) => {
  const ticketId = await createTicket(page, testInfo);
  await signIn(page, "e2e-staff@example.test");
  await page.goto(`/tickets/${ticketId}`);
  const section = actionSection(page);
  await expect(section.getByText("No Actions Taken yet.")).toBeVisible();
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill("Replace and test the network cable.");
  await section
    .getByRole("textbox", { exact: true, name: "Result" })
    .fill("Replaced the cable and tested both ports.");
  await section
    .getByRole("combobox", { exact: true, name: "Assignee" })
    .selectOption({ label: "E2E Second IT Staff · IT Staff" });
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();

  const completionDescription = "Replace and test the network cable.";
  const completionCard = actionCardByDescription(page, completionDescription);
  const completionActionId = await actionIdFromCard(completionCard);
  await expect(completionCard.locator(".status-badge")).toContainText(
    "Planned"
  );
  await expect(
    completionCard.getByText("E2E Second IT Staff · IT Staff", { exact: true })
  ).toBeVisible();
  await expect(
    completionCard.getByRole("button", {
      name: `Start Action Taken #${completionActionId}`,
    })
  ).toBeVisible();
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    file: "action-start-ready",
    role: "IT Staff",
    scenario: "Planned Action Taken assigned to a second worker",
  });
  await checkResponsiveWidths(page, testInfo, "IT Staff");

  await logOut(page);
  await signIn(page, "e2e-staff-second@example.test");
  await page.goto(`/tickets/${ticketId}`);
  const assignedCard = actionCardByDescription(page, completionDescription);
  await assignedCard
    .getByRole("button", {
      name: `Start Action Taken #${completionActionId}`,
    })
    .click();
  await expect(assignedCard.locator(".status-badge")).toContainText(
    "In Progress"
  );
  const performerRow = assignedCard
    .getByText("Performed by", { exact: true })
    .locator("xpath=..");
  await expect(performerRow).toContainText("E2E Second IT Staff · IT Staff");
  const completeButton = assignedCard.getByRole("button", {
    name: `Complete Action Taken #${completionActionId}`,
  });
  await expect(
    assignedCard.getByText("Replaced the cable and tested both ports.")
  ).toBeVisible();
  await completeButton.click();
  const completionDialog = page.getByRole("alertdialog");
  await expect(completionDialog).toContainText(
    "After completion, you cannot edit or change this Action Taken."
  );
  await expect(
    completionDialog.getByRole("button", { name: "Keep Action Taken" })
  ).toBeFocused();
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    file: "action-complete-confirmation",
    role: "IT Staff",
    scenario: "Completion confirmation with a saved Result",
  });
  await checkResponsiveWidths(page, testInfo, "IT Staff");
  await checkNativePageScale(page, testInfo, "IT Staff");
  await completionDialog
    .getByRole("button", { name: "Confirm completion" })
    .click();
  await expect(assignedCard.locator(".status-badge")).toContainText(
    "Completed"
  );
  const assignedCardStatus = assignedCard.getByRole("status").filter({
    hasText: "Action Taken completed.",
  });
  await expect(assignedCardStatus).toBeVisible();
  await expect(assignedCardStatus).toBeFocused();
  // oxlint-disable no-await-in-loop -- Check each absent control separately.
  for (const actionName of [
    `Start Action Taken #${completionActionId}`,
    `Complete Action Taken #${completionActionId}`,
    `Cancel Action Taken #${completionActionId}`,
    `Edit Action Taken #${completionActionId}`,
    `Assign Action Taken #${completionActionId}`,
  ]) {
    await expect(
      assignedCard.getByRole("button", { name: actionName })
    ).toHaveCount(0);
  }
  // oxlint-enable no-await-in-loop
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill("Cancel the unused spare cable check.");
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  const cancellationDescription = "Cancel the unused spare cable check.";
  const cancellationCard = actionCardByDescription(
    page,
    cancellationDescription
  );
  const cancellationActionId = await actionIdFromCard(cancellationCard);
  await cancellationCard
    .getByRole("button", {
      name: `Cancel Action Taken #${cancellationActionId}`,
    })
    .click();
  const cancellationDialog = page.getByRole("alertdialog");
  await expect(cancellationDialog).toContainText(
    "After cancellation, you cannot edit or change this Action Taken."
  );
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    file: "action-cancel-confirmation",
    role: "IT Staff",
    scenario: "Cancellation confirmation for a Planned Action Taken",
  });
  await cancellationDialog
    .getByRole("button", { name: "Confirm cancellation" })
    .click();
  await expect(cancellationCard.locator(".status-badge")).toContainText(
    "Cancelled"
  );
  const cancellationCardStatus = cancellationCard.getByRole("status").filter({
    hasText: "Action Taken cancelled.",
  });
  await expect(cancellationCardStatus).toBeVisible();
  await expect(cancellationCardStatus).toBeFocused();
  // oxlint-disable no-await-in-loop -- Check each absent control separately.
  for (const actionName of [
    `Start Action Taken #${cancellationActionId}`,
    `Complete Action Taken #${cancellationActionId}`,
    `Cancel Action Taken #${cancellationActionId}`,
    `Edit Action Taken #${cancellationActionId}`,
    `Assign Action Taken #${cancellationActionId}`,
  ]) {
    await expect(
      cancellationCard.getByRole("button", { name: actionName })
    ).toHaveCount(0);
  }
  // oxlint-enable no-await-in-loop

  await logOut(page);
  await signIn(page, "e2e-desktop@example.test");
  await page.goto(`/tickets/${ticketId}`);
  const requesterCompletionCard = actionCardByDescription(
    page,
    completionDescription
  );
  const requesterCancellationCard = actionCardByDescription(
    page,
    cancellationDescription
  );
  await expect(requesterCompletionCard.locator(".status-badge")).toContainText(
    "Completed"
  );
  await expect(
    requesterCancellationCard.locator(".status-badge")
  ).toContainText("Cancelled");
  await expect(
    requesterCompletionCard.getByRole("button", {
      name: `View history for Action Taken #${completionActionId}`,
    })
  ).toBeVisible();
  await requesterCompletionCard
    .getByRole("button", {
      name: `View history for Action Taken #${completionActionId}`,
    })
    .click();
  await requesterCancellationCard
    .getByRole("button", {
      name: `View history for Action Taken #${cancellationActionId}`,
    })
    .click();
  const completionEvents = requesterCompletionCard.locator(
    ".action-history .action-card"
  );
  const cancellationEvents = requesterCancellationCard.locator(
    ".action-history .action-card"
  );
  await expect(completionEvents).toHaveCount(3);
  await expect(completionEvents.nth(0)).toContainText("ActionCreated");
  await expect(completionEvents.nth(1)).toContainText("ActionStarted");
  await expect(completionEvents.nth(2)).toContainText("ActionCompleted");
  await expect(completionEvents.nth(2)).toContainText(
    /\d{1,2} \w{3} \d{4}, \d{2}:\d{2} \(Asia\/Bangkok\)/u
  );
  await expect(cancellationEvents).toHaveCount(2);
  await expect(cancellationEvents.nth(0)).toContainText("ActionCreated");
  await expect(cancellationEvents.nth(1)).toContainText("ActionCancelled");
  await expect(cancellationEvents.nth(1)).toContainText(
    /\d{1,2} \w{3} \d{4}, \d{2}:\d{2} \(Asia\/Bangkok\)/u
  );
  await expect(
    requesterCompletionCard.getByText("ActionCompleted")
  ).toBeVisible();
  await expect(
    requesterCancellationCard.getByText("ActionCancelled")
  ).toBeVisible();
  await expect(
    requesterCompletionCard
      .locator(".action-history .action-card")
      .filter({ hasText: "ActionCompleted" })
  ).toContainText("E2E Second IT Staff · IT Staff");
  await expect(
    requesterCancellationCard
      .locator(".action-history .action-card")
      .filter({ hasText: "ActionCancelled" })
  ).toContainText("E2E Second IT Staff · IT Staff");
  await expect(
    requesterCompletionCard.getByRole("button", {
      name: `Start Action Taken #${completionActionId}`,
    })
  ).toHaveCount(0);
  await expect(
    requesterCompletionCard.getByRole("button", {
      name: `Complete Action Taken #${completionActionId}`,
    })
  ).toHaveCount(0);
  await expect(
    requesterCancellationCard.getByRole("button", {
      name: `Cancel Action Taken #${cancellationActionId}`,
    })
  ).toHaveCount(0);
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    file: "action-terminal-history",
    role: "Requester",
    scenario: "Requester reads completion and cancellation events",
  });
});
