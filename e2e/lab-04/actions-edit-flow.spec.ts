import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type {
  APIResponse,
  Browser,
  BrowserContext,
  Page,
  TestInfo,
} from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const password = "correct horse battery staple";
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const screenshotsRoot = path.resolve(
  repositoryRoot,
  "artifacts",
  "lab-04",
  "screenshots",
  "actions-edit"
);
const evidenceCommand =
  "pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-edit-flow.spec.ts";
const styleReviewLink = "docs/lab-04/tests.md#style-01";
const visualReviewLink = "docs/lab-04/tests.md#vis-01";

type ViewportName = "desktop" | "tablet" | "mobile";
type StateSource = "intercepted" | "natural" | "seeded";
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
  stateSource: StateSource;
  viewport: ViewportSpec;
  zoom: {
    mode: ZoomMode;
    result: string;
  };
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
  name: string;
  role: string;
  scenario: string;
  stateSource: StateSource;
  zoom?: {
    mode: ZoomMode;
    result: string;
  };
}

type JsonObject = Record<string, unknown>;

const viewportByProject = new Map<string, ViewportSpec>([
  ["desktop-chromium", { height: 900, name: "desktop", width: 1440 }],
  ["tablet-chromium", { height: 1024, name: "tablet", width: 768 }],
  ["mobile-chromium", { height: 844, name: "mobile", width: 390 }],
]);

const manifests = new Map<string, EvidenceManifest>();

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown, label: string): JsonObject => {
  if (!isRecord(value)) {
    throw new TypeError(`Expected ${label} to be an object.`);
  }

  return value;
};

const getString = (object: JsonObject, key: string): string => {
  const value = object[key];
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${key} to be a string.`);
  }

  return value;
};

const getNumber = (object: JsonObject, key: string): number => {
  const value = object[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`Expected ${key} to be a safe integer.`);
  }

  return value;
};

const readJson = async (response: APIResponse): Promise<JsonObject> =>
  asRecord(await response.json(), "API response");

const repositoryValue = (args: readonly string[]): string => {
  try {
    return execFileSync("git", ["-C", repositoryRoot, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
};

const repositorySourceIsDirty = (): boolean =>
  repositoryValue([
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ":(exclude)artifacts/lab-04/screenshots/**",
    ":(exclude)e2e/test-results/**",
    ":(exclude)e2e/playwright-report/**",
  ]).length > 0;

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
  sourceDirty: repositorySourceIsDirty(),
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
  manifests.set(projectName, manifest);
  await writeManifest(projectName, manifest);
};

const capture = async (
  page: Page,
  testInfo: TestInfo,
  options: CaptureOptions
): Promise<void> => {
  const viewport = viewportForProject(testInfo.project.name);
  const filePath = path.resolve(
    screenshotsRoot,
    `${options.name}-${viewport.name}.png`
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({ fullPage: true, path: filePath });

  let manifest = manifests.get(testInfo.project.name);
  if (manifest === undefined) {
    manifest = createManifest(testInfo.project.name);
    manifests.set(testInfo.project.name, manifest);
  }

  const relativePath = path.relative(repositoryRoot, filePath);
  const record: CaptureRecord = {
    capturedAt: new Date().toISOString(),
    path: relativePath,
    review: { style: styleReviewLink, visual: visualReviewLink },
    role: options.role,
    scenario: options.scenario,
    stateSource: options.stateSource,
    viewport: {
      height: page.viewportSize()?.height ?? viewport.height,
      name: viewport.name,
      width: page.viewportSize()?.width ?? viewport.width,
    },
    zoom: {
      mode: options.zoom?.mode ?? "default",
      result:
        options.zoom?.result ??
        `Default project viewport ${viewport.width}×${viewport.height}`,
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

const openProjectContext = async (
  browser: Browser,
  testInfo: TestInfo
): Promise<BrowserContext> => {
  const viewport = viewportForProject(testInfo.project.name);
  const isMobile = viewport.name === "mobile";
  return await browser.newContext({
    hasTouch: isMobile,
    isMobile,
    viewport: { height: viewport.height, width: viewport.width },
  });
};

const getSession = async (
  page: Page
): Promise<{ csrfToken: string; userId: number }> => {
  const response = await page.request.get(`${apiUrl}/api/auth/me`);
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  const user = asRecord(body.user, "authenticated user");

  return {
    csrfToken: getString(body, "csrfToken"),
    userId: getNumber(user, "id"),
  };
};

const createTicket = async (
  page: Page,
  testInfo: TestInfo
): Promise<{ id: number; version: number }> => {
  await signIn(page, "e2e-desktop@example.test");
  const session = await getSession(page);
  const response = await page.request.post(`${apiUrl}/api/tickets`, {
    headers: { Origin: appOrigin, "X-CSRF-Token": session.csrfToken },
    multipart: {
      categoryId: "1",
      description: "Ticket for the authenticated Action Taken edit flow.",
      relatedSystemId: "1",
      requestedPriority: "Low",
      summary: `E2E action edit ${testInfo.project.name} ${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = await readJson(response);
  const ticket = asRecord(body.ticket, "created Ticket");
  await logOut(page);

  return {
    id: getNumber(ticket, "id"),
    version: getNumber(ticket, "version"),
  };
};

const claimTicket = async (
  page: Page,
  ticketId: number,
  version: number,
  csrfToken: string
): Promise<void> => {
  const response = await page.request.post(
    `${apiUrl}/api/tickets/${ticketId}/claim`,
    {
      data: { version },
      headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
    }
  );
  expect(response.status()).toBe(200);
};

const setAccountActive = async (
  page: Page,
  userId: number,
  isActive: boolean,
  csrfToken: string
): Promise<void> => {
  const response = await page.request.patch(`${apiUrl}/api/users/${userId}`, {
    data: { isActive },
    headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
  });
  expect(response.status()).toBe(200);
};

const readTicket = async (
  page: Page,
  ticketId: number
): Promise<JsonObject> => {
  const response = await page.request.get(`${apiUrl}/api/tickets/${ticketId}`);
  expect(response.status()).toBe(200);
  return await readJson(response);
};

const readTicketOwnerId = async (
  page: Page,
  ticketId: number
): Promise<number | null> => {
  const ticket = await readTicket(page, ticketId);
  if (ticket.owner === null) {
    return null;
  }
  return getNumber(asRecord(ticket.owner, "Ticket Owner"), "id");
};

const actionSection = (page: Page) =>
  page.getByRole("region", { name: "Actions Taken" });

const actionIdFromSection = async (
  section: ReturnType<typeof actionSection>
) => {
  const heading = section.getByRole("heading", {
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

const actionCard = (
  section: ReturnType<typeof actionSection>,
  actionId: number
) =>
  section
    .getByRole("listitem")
    .filter({ hasText: `Action Taken #${actionId}` })
    .first();

const editPanel = (card: ReturnType<typeof actionCard>, actionId: number) =>
  card
    .getByRole("heading", {
      exact: true,
      name: new RegExp(`^(Edit|Assign) Action Taken #${actionId}$`, "u"),
    })
    .locator("..");

const createActionThroughUi = async (
  page: Page,
  ticketId: number,
  description: string
): Promise<number> => {
  await page.goto(`/tickets/${ticketId}`);
  const section = actionSection(page);
  await expect(section.getByText("No Actions Taken yet.")).toBeVisible();
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill(description);
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  return await actionIdFromSection(section);
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

const captureNativePageScale = async (
  page: Page,
  testInfo: TestInfo
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
    await expect(actionSection(page)).toBeVisible();
    await capture(page, testInfo, {
      name: "action-edit-native-page-scale-200-percent",
      role: "IT Staff",
      scenario: "Action Taken edit detail at native Chromium page scale 200%",
      stateSource: "natural",
      zoom: {
        mode: "native-page-scale-200-percent",
        result: "Chromium page scale was 2 and Actions Taken remained visible",
      },
    });
  } finally {
    await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await expect
      .poll(async () => await page.evaluate(() => visualViewport?.scale))
      .toBe(1);
    await session.detach();
  }
};

const updateActionForHistory = async (
  page: Page,
  ticketId: number,
  actionId: number,
  csrfToken: string,
  body: {
    actionVersion: number;
    attachmentNotes: string | null;
    assigneeId: number;
    description: string;
    followUpNote: string | null;
    followUpRequired: boolean;
    result: string | null;
    ticketVersion: number;
  }
): Promise<{ action: JsonObject; ticket: JsonObject }> => {
  const response = await page.request.put(
    `${apiUrl}/api/tickets/${ticketId}/actions/${actionId}`,
    {
      data: body,
      headers: { Origin: appOrigin, "X-CSRF-Token": csrfToken },
    }
  );
  expect(response.status()).toBe(200);
  const mutation = await readJson(response);

  return {
    action: asRecord(mutation.action, "updated action"),
    ticket: asRecord(mutation.ticket, "updated Ticket"),
  };
};

test.beforeAll(async ({ browserName }, workerInfo) => {
  expect(browserName).toBe("chromium");
  await resetManifest(workerInfo.project.name);
});

test("two staff browser contexts review a real action conflict and preserve Ticket ownership", async ({
  browser,
  page,
}, testInfo) => {
  const ticket = await createTicket(page, testInfo);
  let staffOneContext: BrowserContext | undefined;
  let staffTwoContext: BrowserContext | undefined;
  let adminContext: BrowserContext | undefined;
  let requesterContext: BrowserContext | undefined;
  let adminPageForCleanup: Page | undefined;
  let adminCsrfToken: string | undefined;
  let staffTwoId: number | undefined;
  let staffTwoWasDeactivated = false;

  try {
    staffOneContext = await openProjectContext(browser, testInfo);
    staffTwoContext = await openProjectContext(browser, testInfo);
    adminContext = await openProjectContext(browser, testInfo);
    requesterContext = await openProjectContext(browser, testInfo);

    const staffOnePage = await staffOneContext.newPage();
    const staffTwoPage = await staffTwoContext.newPage();
    const adminPage = await adminContext.newPage();
    adminPageForCleanup = adminPage;
    const requesterPage = await requesterContext.newPage();

    await signIn(staffOnePage, "e2e-staff@example.test");
    const staffOneSession = await getSession(staffOnePage);
    await claimTicket(
      staffOnePage,
      ticket.id,
      ticket.version,
      staffOneSession.csrfToken
    );
    expect(await readTicketOwnerId(staffOnePage, ticket.id)).toBe(
      staffOneSession.userId
    );
    const actionId = await createActionThroughUi(
      staffOnePage,
      ticket.id,
      "Replace and test the damaged network cable."
    );

    await signIn(staffTwoPage, "e2e-staff-second@example.test");
    const staffTwoSession = await getSession(staffTwoPage);
    staffTwoId = staffTwoSession.userId;
    await staffTwoPage.goto(`/tickets/${ticket.id}`);
    const staffTwoSection = actionSection(staffTwoPage);
    const staffTwoCard = actionCard(staffTwoSection, actionId);
    await expect(
      staffTwoCard.getByRole("heading", {
        exact: true,
        name: `Action Taken #${actionId}`,
      })
    ).toBeVisible();

    await staffTwoCard
      .getByRole("button", {
        exact: true,
        name: `Assign Action Taken #${actionId}`,
      })
      .click();
    const assignmentPanel = editPanel(staffTwoCard, actionId);
    const assignee = assignmentPanel.getByRole("combobox", {
      exact: true,
      name: "Assignee",
    });
    await expect(assignee).toBeVisible();
    await expect(assignee).toBeFocused();
    await expect(
      assignmentPanel.getByRole("textbox", {
        exact: true,
        name: "Action Description",
      })
    ).toBeVisible();
    await expect(
      assignmentPanel.getByRole("textbox", { exact: true, name: "Result" })
    ).toBeVisible();
    await expect(
      assignmentPanel.getByRole("checkbox", {
        exact: true,
        name: "Follow-Up Required",
      })
    ).toBeVisible();
    await expect(
      assignmentPanel.getByRole("textbox", {
        exact: true,
        name: "Attachment Notes",
      })
    ).toBeVisible();
    await expect(
      assignmentPanel.getByRole("button", { exact: true, name: "Cancel" })
    ).toBeVisible();
    await expect(
      assignmentPanel.getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
    ).toBeVisible();

    const followUp = assignmentPanel.getByRole("checkbox", {
      exact: true,
      name: "Follow-Up Required",
    });
    await followUp.check();
    const followUpNote = assignmentPanel.getByRole("textbox", {
      exact: true,
      name: "Follow-up Note",
    });
    await expect(followUpNote).toBeVisible();
    await followUpNote.fill("Clear this note when follow-up is not required.");
    await followUp.uncheck();
    await expect(followUpNote).toHaveCount(0);
    await assignee.selectOption({ label: "E2E Second IT Staff · IT Staff" });
    await checkLayoutAndAccessibility(staffTwoPage);
    await capture(staffTwoPage, testInfo, {
      name: "action-edit-reassign",
      role: "IT Staff",
      scenario:
        "Second staff member reviews the shared edit form before reassignment",
      stateSource: "natural",
    });

    await signIn(adminPage, "e2e-admin@example.test");
    const adminSession = await getSession(adminPage);
    adminCsrfToken = adminSession.csrfToken;

    const staffOneSection = actionSection(staffOnePage);
    const staffOneCard = actionCard(staffOneSection, actionId);
    await staffOneCard
      .getByRole("button", {
        exact: true,
        name: `Edit Action Taken #${actionId}`,
      })
      .click();
    const staleEditPanel = editPanel(staffOneCard, actionId);
    const staleDescription = staleEditPanel.getByRole("textbox", {
      exact: true,
      name: "Action Description",
    });
    const staleAssignee = staleEditPanel.getByRole("combobox", {
      exact: true,
      name: "Assignee",
    });
    await expect(staleDescription).toBeFocused();
    await expect(staleAssignee).toHaveValue(String(staffOneSession.userId));
    await staleDescription.fill(
      "Worker one's draft survives two concurrent writes."
    );

    const assignmentSave = assignmentPanel.getByRole("button", {
      exact: true,
      name: "Save Action Taken",
    });
    await assignmentSave.focus();
    await expect(assignmentSave).toBeFocused();
    await staffTwoPage.keyboard.press("Enter");
    await expect(
      staffTwoCard.getByText("E2E Second IT Staff · IT Staff", { exact: true })
    ).toBeVisible();
    expect(await readTicketOwnerId(staffTwoPage, ticket.id)).toBe(
      staffOneSession.userId
    );

    staffTwoWasDeactivated = true;
    await setAccountActive(
      adminPage,
      staffTwoSession.userId,
      false,
      adminSession.csrfToken
    );

    // A fresh page gets current eligibility data while the original worker keeps its stale draft.
    const historicalAssigneePage = await staffOneContext.newPage();
    await historicalAssigneePage.goto(`/tickets/${ticket.id}`);
    await expect(historicalAssigneePage).not.toHaveURL(/\/login$/u);
    const historicalSection = actionSection(historicalAssigneePage);
    const historicalCard = actionCard(historicalSection, actionId);
    await expect(
      historicalCard.getByText("Inactive · ineligible", { exact: true })
    ).toBeVisible();
    await historicalCard
      .getByRole("button", {
        exact: true,
        name: `Edit Action Taken #${actionId}`,
      })
      .click();
    const historicalAssigneePanel = editPanel(historicalCard, actionId);
    const historicalAssignee = historicalAssigneePanel.getByRole("combobox", {
      exact: true,
      name: "Assignee",
    });
    await expect(historicalAssignee).toHaveValue(
      String(staffTwoSession.userId)
    );
    const historicalAssigneeOption = historicalAssignee
      .locator("option")
      .filter({ hasText: "E2E Second IT Staff" });
    await expect(historicalAssigneeOption).toHaveCount(1);
    await expect(historicalAssigneeOption).toContainText(
      "current ineligible assignee"
    );
    await historicalAssigneePanel
      .getByRole("textbox", { exact: true, name: "Result" })
      .fill("Staff edited details while retaining the historical assignee.");
    await checkLayoutAndAccessibility(historicalAssigneePage);
    await capture(historicalAssigneePage, testInfo, {
      name: "action-edit-historical-assignee",
      role: "IT Staff",
      scenario:
        "Edit form retains an ineligible historical assignee while listing eligible choices",
      stateSource: "natural",
    });
    await historicalAssigneePanel
      .getByRole("button", { exact: true, name: "Save Action Taken" })
      .click();
    await expect(
      historicalCard.getByText("E2E Second IT Staff · IT Staff", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      historicalCard.getByText(
        "Staff edited details while retaining the historical assignee.",
        { exact: true }
      )
    ).toBeVisible();

    await adminPage.goto(`/tickets/${ticket.id}`);
    const adminSection = actionSection(adminPage);
    const adminCard = actionCard(adminSection, actionId);
    await adminCard
      .getByRole("button", {
        exact: true,
        name: `Edit Action Taken #${actionId}`,
      })
      .click();
    const adminEditPanel = editPanel(adminCard, actionId);
    await adminEditPanel
      .getByRole("textbox", { exact: true, name: "Result" })
      .fill("Administrator saved a concurrent result.");
    await adminEditPanel
      .getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
      .click();
    await expect(
      adminCard.getByText("Administrator saved a concurrent result.", {
        exact: true,
      })
    ).toBeVisible();

    await staleEditPanel
      .getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
      .click();
    await expect(
      staleEditPanel.getByText(
        "The saved action or Ticket changed. Your draft is preserved. Refresh and review before saving again.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      staleEditPanel.getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
    ).toBeDisabled();
    await expect(
      staleEditPanel.getByRole("textbox", {
        exact: true,
        name: "Action Description",
      })
    ).toHaveValue("Worker one's draft survives two concurrent writes.");
    await expect(staleAssignee).toHaveValue(String(staffOneSession.userId));
    await checkLayoutAndAccessibility(staffOnePage);
    await capture(staffOnePage, testInfo, {
      name: "action-conflict-draft",
      role: "IT Staff",
      scenario:
        "A real second worker edit leaves the stale draft intact and blocks Save",
      stateSource: "natural",
    });

    await staleEditPanel
      .getByRole("button", { exact: true, name: "Refresh and review" })
      .click();
    await expect(
      staleEditPanel.getByRole("heading", {
        exact: true,
        name: "Latest saved values",
      })
    ).toBeVisible();
    const latestSavedValues = staleEditPanel
      .getByRole("heading", { exact: true, name: "Latest saved values" })
      .locator("..");
    await expect(
      latestSavedValues.getByText("Administrator saved a concurrent result.", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      latestSavedValues.getByText("E2E Second IT Staff · IT Staff", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      staleEditPanel.getByRole("textbox", {
        exact: true,
        name: "Action Description",
      })
    ).toHaveValue("Worker one's draft survives two concurrent writes.");
    await expect(staleAssignee).toHaveValue(String(staffOneSession.userId));
    await expect(
      staleEditPanel.getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
    ).toBeEnabled();

    const longReviewedDescription = `Reviewed after refresh. ${"Long repair notes wrap without pushing the page sideways. ".repeat(12)}`;
    await staleEditPanel
      .getByRole("textbox", {
        exact: true,
        name: "Action Description",
      })
      .fill(longReviewedDescription);
    await staleEditPanel
      .getByRole("textbox", { exact: true, name: "Result" })
      .fill("Administrator saved a concurrent result.");
    await staleEditPanel
      .getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
      .click();
    await expect(
      staffOneCard.getByText(longReviewedDescription, { exact: true })
    ).toBeVisible();
    await expect(
      staffOneCard.getByRole("button", {
        exact: true,
        name: `Edit Action Taken #${actionId}`,
      })
    ).toBeFocused();
    expect(await readTicketOwnerId(staffOnePage, ticket.id)).toBe(
      staffOneSession.userId
    );

    await staffOnePage.setViewportSize({ height: 844, width: 320 });
    await checkLayoutAndAccessibility(staffOnePage);
    await capture(staffOnePage, testInfo, {
      name: "action-edit-minimum-width-320",
      role: "IT Staff",
      scenario: "Saved long Action Description at 320 CSS pixels",
      stateSource: "natural",
      zoom: {
        mode: "minimum-width-320-css-pixels",
        result:
          "320 CSS-pixel viewport passed without page-wide horizontal overflow",
      },
    });
    await staffOnePage.setViewportSize({ height: 450, width: 720 });
    await checkLayoutAndAccessibility(staffOnePage);
    await capture(staffOnePage, testInfo, {
      name: "action-edit-css-reflow-200-percent",
      role: "IT Staff",
      scenario: "Saved long Action Description at the 200% CSS reflow proxy",
      stateSource: "natural",
      zoom: {
        mode: "css-reflow-200-percent",
        result:
          "720 CSS-pixel viewport passed without page-wide horizontal overflow",
      },
    });
    const projectViewport = viewportForProject(testInfo.project.name);
    await staffOnePage.setViewportSize({
      height: projectViewport.height,
      width: projectViewport.width,
    });
    await captureNativePageScale(staffOnePage, testInfo);

    await adminPage.reload();
    const freshAdminCard = actionCard(actionSection(adminPage), actionId);
    await expect(
      freshAdminCard.getByRole("heading", {
        exact: true,
        name: `Action Taken #${actionId}`,
      })
    ).toBeVisible();
    await freshAdminCard
      .getByRole("button", {
        exact: true,
        name: `Assign Action Taken #${actionId}`,
      })
      .click();
    const adminAssignmentPanel = editPanel(freshAdminCard, actionId);
    await adminAssignmentPanel
      .getByRole("combobox", { exact: true, name: "Assignee" })
      .selectOption({ label: "E2E Administrator · Administrator" });
    await adminAssignmentPanel
      .getByRole("button", {
        exact: true,
        name: "Save Action Taken",
      })
      .click();
    await expect(
      freshAdminCard.getByText("E2E Administrator · Administrator", {
        exact: true,
      })
    ).toBeVisible();
    expect(await readTicketOwnerId(adminPage, ticket.id)).toBe(
      staffOneSession.userId
    );

    if (staffTwoWasDeactivated && staffTwoId !== undefined) {
      await setAccountActive(
        adminPage,
        staffTwoId,
        true,
        adminSession.csrfToken
      );
      staffTwoWasDeactivated = false;
    }

    const actionsResponse = await adminPage.request.get(
      `${apiUrl}/api/tickets/${ticket.id}/actions?page=1&pageSize=20`
    );
    expect(actionsResponse.status()).toBe(200);
    const actionsPage = await readJson(actionsResponse);
    if (!Array.isArray(actionsPage.items) || actionsPage.items.length === 0) {
      throw new TypeError(
        "Expected the action to be present for history setup."
      );
    }
    let latestAction = asRecord(actionsPage.items[0], "latest Action Taken");
    let latestTicket = await readTicket(adminPage, ticket.id);
    let actionVersion = getNumber(latestAction, "version");
    let ticketVersion = getNumber(latestTicket, "version");
    const latestAssignee = asRecord(latestAction.assignee, "current assignee");
    const assigneeId = getNumber(latestAssignee, "id");
    const latestResult =
      latestAction.result === null ? null : getString(latestAction, "result");
    const latestFollowUpNote =
      latestAction.followUpNote === null
        ? null
        : getString(latestAction, "followUpNote");
    const latestAttachmentNotes =
      latestAction.attachmentNotes === null
        ? null
        : getString(latestAction, "attachmentNotes");
    const followUpRequired = latestAction.followUpRequired === true;

    // Seed fifteen real, sequential API revisions so the public browser history crosses its page boundary.
    // oxlint-disable no-await-in-loop -- Each real write returns the versions required by the next one.
    for (let index = 1; index <= 15; index += 1) {
      const mutation = await updateActionForHistory(
        adminPage,
        ticket.id,
        actionId,
        adminSession.csrfToken,
        {
          actionVersion,
          assigneeId,
          attachmentNotes: latestAttachmentNotes,
          description: `History snapshot ${index}: ${"verified revision text ".repeat(4)}`,
          followUpNote: latestFollowUpNote,
          followUpRequired,
          result: latestResult,
          ticketVersion,
        }
      );
      latestAction = mutation.action;
      latestTicket = mutation.ticket;
      actionVersion = getNumber(latestAction, "version");
      ticketVersion = getNumber(latestTicket, "version");
    }
    // oxlint-enable no-await-in-loop
    expect(await readTicketOwnerId(adminPage, ticket.id)).toBe(
      staffOneSession.userId
    );

    await signIn(requesterPage, "e2e-desktop@example.test");
    await requesterPage.goto(`/tickets/${ticket.id}`);
    const requesterSection = actionSection(requesterPage);
    const requesterCard = actionCard(requesterSection, actionId);
    await expect(
      requesterCard.getByText("E2E Administrator · Administrator", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      requesterSection.getByRole("button", {
        exact: true,
        name: `Edit Action Taken #${actionId}`,
      })
    ).toHaveCount(0);
    await expect(
      requesterSection.getByRole("button", {
        exact: true,
        name: `Assign Action Taken #${actionId}`,
      })
    ).toHaveCount(0);
    await expect(requesterSection.getByRole("textbox")).toHaveCount(0);

    await requesterCard
      .getByRole("button", {
        exact: true,
        name: `View history for Action Taken #${actionId}`,
      })
      .click();
    const history = requesterCard.getByRole("region", {
      name: `Action Taken #${actionId} history`,
    });
    await expect(history).toBeVisible();
    await expect(history.getByRole("listitem")).toHaveCount(20);
    const assignmentEvent = history
      .getByRole("listitem")
      .filter({ hasText: "E2E Second IT Staff · IT Staff" });
    await expect(assignmentEvent).toContainText("ActionEdited");
    await expect(assignmentEvent).toContainText("Action Description");
    await expect(assignmentEvent).toContainText(
      "Replace and test the damaged network cable."
    );
    await expect(assignmentEvent).toContainText("Assignee");
    await expect(assignmentEvent).toContainText(
      `Former assignee (User #${staffTwoId})`
    );
    await expect(assignmentEvent).toContainText(
      /\d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} \(Asia\/Bangkok\)/u
    );
    await history
      .getByRole("button", { exact: true, name: "Next history" })
      .click();
    await expect(history.getByText(/Page 2 of 2 · 21 revision/u)).toBeVisible();
    await expect(history.getByRole("listitem")).toHaveCount(1);
    const latestEvent = history
      .getByRole("listitem")
      .filter({ hasText: "E2E Administrator · Administrator" });
    await expect(latestEvent).toContainText("ActionEdited");
    await expect(latestEvent).toContainText("History snapshot 15:");
    await expect(latestEvent).toContainText(
      /\d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} \(Asia\/Bangkok\)/u
    );
    expect(await readTicketOwnerId(requesterPage, ticket.id)).toBe(
      staffOneSession.userId
    );
    await checkLayoutAndAccessibility(requesterPage);
    await capture(requesterPage, testInfo, {
      name: "action-edit-requester-history-page-two",
      role: "Requester",
      scenario:
        "Requester reads the paginated second history page with actor, time, and snapshot",
      stateSource: "seeded",
    });

    const currentTicket = await readTicket(requesterPage, ticket.id);
    expect(getNumber(currentTicket, "version")).toBe(ticketVersion);
  } finally {
    if (
      staffTwoWasDeactivated &&
      staffTwoId !== undefined &&
      adminPageForCleanup !== undefined &&
      adminCsrfToken !== undefined
    ) {
      await setAccountActive(
        adminPageForCleanup,
        staffTwoId,
        true,
        adminCsrfToken
      );
    }
    await Promise.all(
      [staffOneContext, staffTwoContext, adminContext, requesterContext]
        .filter((context): context is BrowserContext => context !== undefined)
        .map(async (context) => {
          await context.close();
        })
    );
  }
});

test("assignee loading, failure, empty choices, and retry keep an edit draft recoverable", async ({
  page,
}, testInfo) => {
  const ticket = await createTicket(page, testInfo);
  await signIn(page, "e2e-staff@example.test");
  const staffSession = await getSession(page);
  const actionId = await createActionThroughUi(
    page,
    ticket.id,
    "Initial action for assignee lookup recovery."
  );
  let releaseOwnersRequest: (() => void) | undefined;
  // oxlint-disable-next-line promise/avoid-new -- The route gate exposes the real pending assignee state.
  const ownersGate = new Promise<void>((resolve) => {
    releaseOwnersRequest = resolve;
  });
  let responseMode: "hold" | "failure" | "empty" = "hold";
  await page.route(`${apiUrl}/api/staff/owners`, async (route) => {
    if (responseMode === "hold") {
      await ownersGate;
      responseMode = "failure";
    }
    if (responseMode === "failure") {
      await route.fulfill({
        body: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "Eligible assignees could not be loaded.",
          },
        }),
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-origin": appOrigin,
          "content-type": "application/json",
        },
        status: 503,
      });
      return;
    }
    if (responseMode === "empty") {
      await route.fulfill({
        body: JSON.stringify({ items: [] }),
        headers: {
          "access-control-allow-credentials": "true",
          "access-control-allow-origin": appOrigin,
          "content-type": "application/json",
        },
        status: 200,
      });
      return;
    }
    await route.continue();
  });

  await page.reload();
  const refreshedSection = actionSection(page);
  const refreshedCard = actionCard(refreshedSection, actionId);
  await refreshedCard
    .getByRole("button", {
      exact: true,
      name: `Edit Action Taken #${actionId}`,
    })
    .click();
  const panel = editPanel(refreshedCard, actionId);
  const description = panel.getByRole("textbox", {
    exact: true,
    name: "Action Description",
  });
  const assignee = panel.getByRole("combobox", {
    exact: true,
    name: "Assignee",
  });
  await description.fill("Keep this draft through the assignee lookup retry.");
  await expect(
    panel.getByText("Loading eligible assignees…", { exact: true })
  ).toBeVisible();
  await expect(assignee).toBeDisabled();
  await expect(
    panel.getByRole("button", { exact: true, name: "Save Action Taken" })
  ).toBeDisabled();
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    name: "action-edit-assignee-loading",
    role: "IT Staff",
    scenario:
      "Edit form shows assignee loading and blocks a save while choices load",
    stateSource: "intercepted",
  });

  releaseOwnersRequest?.();
  await expect(panel.getByRole("alert")).toContainText(
    "Assignees unavailable."
  );
  await expect(description).toHaveValue(
    "Keep this draft through the assignee lookup retry."
  );
  await expect(
    panel.getByRole("button", { exact: true, name: "Save Action Taken" })
  ).toBeDisabled();
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    name: "action-edit-assignee-error",
    role: "IT Staff",
    scenario:
      "A safe assignee lookup failure retains the edit draft and offers retry",
    stateSource: "intercepted",
  });

  responseMode = "empty";
  await panel
    .getByRole("button", { exact: true, name: "Retry assignees" })
    .click();
  await expect(assignee).toBeEnabled();
  await expect(assignee).toHaveValue(String(staffSession.userId));
  await expect(assignee.locator("option")).toHaveCount(2);
  await expect(
    assignee.locator("option").filter({ hasText: "current assignee" })
  ).toHaveCount(1);
  await expect(
    panel.getByText(/No eligible assignees are available/u)
  ).toBeVisible();
  await expect(description).toHaveValue(
    "Keep this draft through the assignee lookup retry."
  );
  await checkLayoutAndAccessibility(page);
  await capture(page, testInfo, {
    name: "action-edit-assignee-empty",
    role: "IT Staff",
    scenario:
      "Empty eligible choices retain only the historical current assignee",
    stateSource: "intercepted",
  });

  await panel
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    refreshedCard.getByText(
      "Keep this draft through the assignee lookup retry.",
      { exact: true }
    )
  ).toBeVisible();
  expect(await readTicketOwnerId(page, ticket.id)).toBeNull();
});
