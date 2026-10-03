import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const origin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const password = "correct horse battery staple";
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const screenshotsRoot = path.resolve(
  repositoryRoot,
  "artifacts",
  "lab-04",
  "screenshots"
);
const actionsTakenScreenshotsRoot = path.resolve(
  screenshotsRoot,
  "actions-taken"
);
const evidenceCommand =
  "pnpm --filter @toktickit/e2e exec playwright test lab-04/actions-taken-flow.spec.ts";
const styleReviewLink = "docs/lab-04/tests.md#style-01";
const visualReviewLink = "docs/lab-04/tests.md#vis-01";

type EvidenceViewport = "desktop" | "mobile" | "tablet";

const viewportNameByProject = new Map<string, EvidenceViewport>([
  ["desktop-chromium", "desktop"],
  ["mobile-chromium", "mobile"],
  ["tablet-chromium", "tablet"],
]);
type EvidenceStateSource = "intercepted" | "natural" | "seeded";
type EvidenceZoomMode =
  | "default"
  | "minimum-width-320-css-pixels"
  | "css-reflow-200-percent"
  | "native-page-scale-200-percent";

interface EvidenceManifestEntry {
  branch: string;
  capturedAt: string;
  command: string;
  commit: string;
  path: string;
  role: string;
  scenario: string;
  stateSource: EvidenceStateSource;
  viewport: {
    height: number;
    name: EvidenceViewport;
    width: number;
  };
  zoom: {
    mode: EvidenceZoomMode;
    result: string;
  };
  review: {
    style: string;
    visual: string;
  };
}

interface EvidenceManifest {
  branch: string;
  command: string;
  commit: string;
  files: EvidenceManifestEntry[];
  generatedAt: string;
  project: string;
  sourceDirty: boolean;
}

interface CaptureOptions {
  role: string;
  scenario: string;
  stateSource: EvidenceStateSource;
  state: string;
  zoom?: {
    mode: EvidenceZoomMode;
    result: string;
  };
}

const repositoryValue = (args: readonly string[]): string =>
  execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

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

const viewportNameForProject = (projectName: string): EvidenceViewport => {
  const viewportName = viewportNameByProject.get(projectName);
  if (viewportName === undefined) {
    throw new Error(`Unsupported evidence project: ${projectName}`);
  }
  return viewportName;
};

const manifestPath = (projectName: string): string =>
  path.resolve(
    actionsTakenScreenshotsRoot,
    `manifest-${viewportNameForProject(projectName)}.json`
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

const manifests = new Map<string, EvidenceManifest>();

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
  await mkdir(actionsTakenScreenshotsRoot, { recursive: true });
  const manifest = createManifest(projectName);
  manifests.set(projectName, manifest);
  await writeManifest(projectName, manifest);
};

const getManifest = async (projectName: string): Promise<EvidenceManifest> => {
  const existing = manifests.get(projectName);
  if (existing !== undefined) {
    return existing;
  }
  await resetManifest(projectName);
  const manifest = manifests.get(projectName);
  if (manifest === undefined) {
    throw new Error(`Could not initialize evidence manifest: ${projectName}`);
  }
  return manifest;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new TypeError("Expected a JSON object.");
  }
  return value;
};

const signIn = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

const logOut = async (page: Page) => {
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

const createTicket = async (page: Page, testInfo: TestInfo) => {
  await signIn(page, "e2e-desktop@example.test");
  const session = await page.request.get(`${apiUrl}/api/auth/me`);
  const sessionBody = asRecord((await session.json()) as unknown);
  if (typeof sessionBody.csrfToken !== "string") {
    throw new TypeError("Expected a CSRF token.");
  }
  const response = await page.request.post(`${apiUrl}/api/tickets`, {
    headers: { Origin: origin, "X-CSRF-Token": sessionBody.csrfToken },
    multipart: {
      categoryId: "1",
      description:
        "Ticket for the browser create and shared action reading journey.",
      relatedSystemId: "1",
      requestedPriority: "Low",
      summary: `E2E actions taken ${testInfo.project.name} ${Date.now()}`,
    },
  });
  expect(response.status()).toBe(201);
  const body = asRecord((await response.json()) as unknown);
  const ticket = asRecord(body.ticket);
  if (typeof ticket.id !== "number") {
    throw new TypeError("Expected a Ticket ID.");
  }
  await logOut(page);
  return ticket.id;
};

const actionSection = (page: Page) =>
  page.getByRole("region", { name: "Actions Taken" });

const checkLayout = async (page: Page) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
};

const capture = async (
  page: Page,
  testInfo: TestInfo,
  captureOptions: CaptureOptions
) => {
  const projectName = testInfo.project.name;
  const viewportName = viewportNameForProject(projectName);
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("Evidence capture requires a fixed viewport.");
  }
  const visualScale = await page.evaluate(() => visualViewport?.scale ?? 1);
  const filePath = path.resolve(
    actionsTakenScreenshotsRoot,
    `${captureOptions.state}-${viewportName}.png`
  );
  await mkdir(actionsTakenScreenshotsRoot, { recursive: true });
  await page.screenshot({
    fullPage: true,
    path: filePath,
  });

  const manifest = await getManifest(projectName);
  const relativePath = path.relative(repositoryRoot, filePath);
  const entry: EvidenceManifestEntry = {
    branch: manifest.branch,
    capturedAt: new Date().toISOString(),
    command: manifest.command,
    commit: manifest.commit,
    path: relativePath,
    review: {
      style: styleReviewLink,
      visual: visualReviewLink,
    },
    role: captureOptions.role,
    scenario: captureOptions.scenario,
    stateSource: captureOptions.stateSource,
    viewport: {
      height: viewport.height,
      name: viewportName,
      width: viewport.width,
    },
    zoom: {
      mode: captureOptions.zoom?.mode ?? "default",
      result: `${captureOptions.zoom?.result ?? "Default project viewport"}; observed viewport ${viewport.width}×${viewport.height}; visualViewport.scale=${visualScale}`,
    },
  };
  const existingIndex = manifest.files.findIndex(
    (file) => file.path === relativePath
  );
  if (existingIndex === -1) {
    manifest.files.push(entry);
  } else {
    manifest.files[existingIndex] = entry;
  }
  await writeManifest(projectName, manifest);
};

const checkNativePageScale = async (
  page: Page,
  testInfo: TestInfo,
  captureOptions: CaptureOptions
) => {
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
      ...captureOptions,
      zoom: {
        mode: "native-page-scale-200-percent",
        result:
          "Native Chromium page scale set to 2 and Actions Taken remained visible",
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

test.beforeAll(async ({ browserName }, workerInfo) => {
  expect(browserName).toBe("chromium");
  await resetManifest(workerInfo.project.name);
});

test("action list shows loading and safe failures, then recovers to its empty state", async ({
  page,
}, testInfo) => {
  const ticketId = await createTicket(page, testInfo);
  await signIn(page, "e2e-staff@example.test");
  let releaseLoading: (() => void) | undefined;
  // oxlint-disable-next-line promise/avoid-new -- A route gate exposes a real browser loading state.
  const loading = new Promise<void>((resolve) => {
    releaseLoading = resolve;
  });
  let responseStatus = 503;
  let holdLoading = true;
  await page.route(`**/api/tickets/${ticketId}/actions?*`, async (route) => {
    if (holdLoading) {
      await loading;
    }
    if (responseStatus === 200) {
      await route.continue();
      return;
    }
    let errorCode = "INTERNAL_ERROR";
    if (responseStatus === 403) {
      errorCode = "FORBIDDEN";
    } else if (responseStatus === 404) {
      errorCode = "RESOURCE_NOT_FOUND";
    }
    await route.fulfill({
      body: JSON.stringify({
        error: {
          code: errorCode,
          message: "Actions Taken could not be loaded.",
        },
      }),
      headers: {
        "access-control-allow-credentials": "true",
        "access-control-allow-origin": origin,
        "content-type": "application/json",
      },
      status: responseStatus,
    });
  });
  await page.goto(`/tickets/${ticketId}`);
  const section = actionSection(page);
  await expect(
    section.getByText("Loading Actions Taken…", { exact: true })
  ).toBeVisible();
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Actions Taken loading state",
    state: "actions-taken-loading",
    stateSource: "intercepted",
  });
  holdLoading = false;
  releaseLoading?.();
  await expect(
    section.getByRole("heading", { name: "Actions Taken unavailable" })
  ).toBeVisible();
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Actions Taken safe 503 failure with retry",
    state: "actions-taken-error",
    stateSource: "intercepted",
  });
  responseStatus = 403;
  await section.getByRole("button", { name: "Retry Actions Taken" }).click();
  await expect(section.getByRole("alert")).toContainText(
    /not allowed|permission|forbidden/iu
  );
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Actions Taken forbidden response with retry",
    state: "actions-taken-forbidden",
    stateSource: "intercepted",
  });
  responseStatus = 404;
  await section.getByRole("button", { name: "Retry Actions Taken" }).click();
  await expect(section.getByRole("alert")).toContainText(/not found/iu);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Actions Taken not-found response with retry",
    state: "actions-taken-not-found",
    stateSource: "intercepted",
  });
  responseStatus = 200;
  await section.getByRole("button", { name: "Retry Actions Taken" }).click();
  await expect(section.getByText("No Actions Taken yet.")).toBeVisible();
  await expect(section.getByRole("alert")).toHaveCount(0);
});

test("different staff create actions; owning Requester reads every plain-text field", async ({
  page,
}, testInfo) => {
  const ticketId = await createTicket(page, testInfo);

  await signIn(page, "e2e-desktop@example.test");
  await page.goto(`/tickets/${ticketId}`);
  const section = actionSection(page);
  await expect(section.getByText("No Actions Taken yet.")).toBeVisible();
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "Requester",
    scenario: "Requester Ticket Detail with no Actions Taken",
    state: "requester-actions-empty",
    stateSource: "natural",
  });
  await logOut(page);

  await signIn(page, "e2e-staff@example.test");
  await page.goto(`/tickets/${ticketId}`);
  await expect(section.getByText("No Actions Taken yet.")).toBeVisible();
  const addButton = section.getByRole("button", {
    exact: true,
    name: "Add Action Taken",
  });
  await addButton.focus();
  await expect(addButton).toBeFocused();
  await page.keyboard.press("Enter");
  const descriptionField = section.getByRole("textbox", {
    exact: true,
    name: "Action Description",
  });
  const followUpRequired = section.getByRole("checkbox", {
    exact: true,
    name: "Follow-Up Required",
  });
  const followUpNoteField = section.getByRole("textbox", {
    exact: true,
    name: "Follow-up Note",
  });
  await expect(descriptionField).toBeVisible();
  await expect(descriptionField).toBeFocused();
  await section.getByRole("button", { exact: true, name: "Cancel" }).click();
  await expect(addButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(descriptionField).toBeFocused();
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(descriptionField).toBeFocused();
  await expect(
    section.getByText(/Action Description must contain/u)
  ).toBeVisible();
  await descriptionField.fill("Conditional follow-up validation sample.");
  await followUpRequired.check();
  await expect(followUpNoteField).toBeVisible();
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByText(
      "Follow-up Note is required when Follow-Up Required is selected.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(followUpNoteField).toBeFocused();
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario:
      "Create form with conditional Follow-up Note validation and keyboard focus",
    state: "action-create-validation",
    stateSource: "natural",
  });
  const initialViewport = page.viewportSize();
  await page.setViewportSize({ height: 844, width: 320 });
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Create form at 320 CSS pixels with conditional validation",
    state: "action-create-form-minimum-width-320-css-pixels",
    stateSource: "natural",
    zoom: {
      mode: "minimum-width-320-css-pixels",
      result: "320 CSS-pixel minimum-width check passed with no page overflow",
    },
  });
  await page.setViewportSize({ height: 450, width: 720 });
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Create form at the 200% CSS reflow proxy",
    state: "action-create-form-css-reflow-200-percent",
    stateSource: "natural",
    zoom: {
      mode: "css-reflow-200-percent",
      result: "720 CSS-pixel reflow proxy passed with no page overflow",
    },
  });
  if (initialViewport) {
    await page.setViewportSize(initialViewport);
  }
  await checkNativePageScale(page, testInfo, {
    role: "IT Staff",
    scenario: "Create form at native Chromium 200% page scale",
    state: "action-create-form-native-page-scale-200-percent",
    stateSource: "natural",
  });
  const description = `<script>alert('plain text')</script>\nInspect cable ${"long-description ".repeat(20)}`;
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill(description);
  await section
    .getByRole("textbox", { exact: true, name: "Result" })
    .fill("Initial inspection recorded.\nContinue with planned work.");
  await section
    .getByRole("checkbox", { exact: true, name: "Follow-Up Required" })
    .check();
  await section
    .getByRole("textbox", { exact: true, name: "Follow-up Note" })
    .fill("Ask the Requester to test connectivity.");
  await section
    .getByRole("textbox", { exact: true, name: "Attachment Notes" })
    .fill("See existing cable-photo.png. <b>Keep as text.</b>");
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByRole("textbox", { exact: true, name: "Action Description" })
  ).toHaveCount(0);
  await expect(section.getByText(description, { exact: true })).toBeVisible();
  await expect(addButton).toBeFocused();
  await expect(section.locator("script")).toHaveCount(0);
  await checkLayout(page);

  await logOut(page);
  await signIn(page, "e2e-staff-second@example.test");
  await page.goto(`/tickets/${ticketId}`);
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill("Second worker plans replacement and verification.");
  await section
    .getByRole("combobox", { exact: true, name: "Assignee" })
    .selectOption({ label: "E2E Administrator · Administrator" });
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByRole("textbox", { exact: true, name: "Action Description" })
  ).toHaveCount(0);
  await expect(
    section.getByText("Second worker plans replacement and verification.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    section.getByText("E2E Second IT Staff · IT Staff", { exact: true })
  ).toBeVisible();
  await expect(
    section.getByText("E2E Administrator · Administrator", { exact: true })
  ).toBeVisible();

  await logOut(page);
  await signIn(page, "e2e-admin@example.test");
  await page.goto(`/tickets/${ticketId}`);
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill("Administrator plans a final support check.");
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByRole("textbox", { exact: true, name: "Action Description" })
  ).toHaveCount(0);
  await expect(
    section.getByText("Administrator plans a final support check.", {
      exact: true,
    })
  ).toBeVisible();
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "Administrator",
    scenario: "Staff/Admin action list with multiple actions and attribution",
    state: "staff-actions-populated",
    stateSource: "natural",
  });

  await logOut(page);
  await signIn(page, "e2e-desktop@example.test");
  await page.goto(`/tickets/${ticketId}`);
  await expect(section.getByText(description, { exact: true })).toBeVisible();
  await expect(
    section.getByText("Ask the Requester to test connectivity.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    section.getByText("See existing cable-photo.png. <b>Keep as text.</b>", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    section.getByRole("button", { exact: true, name: "Add Action Taken" })
  ).toHaveCount(0);
  await expect(section.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Internal Notes" })
  ).toHaveCount(0);
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "Requester",
    scenario:
      "Requester Ticket Detail with multiple Actions Taken and attribution",
    state: "requester-actions-populated",
    stateSource: "natural",
  });
  const requesterViewport = page.viewportSize();
  await page.setViewportSize({ height: 844, width: 320 });
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "Requester",
    scenario: "Requester populated Actions Taken at 320 CSS pixels",
    state: "requester-actions-populated-minimum-width-320-css-pixels",
    stateSource: "natural",
    zoom: {
      mode: "minimum-width-320-css-pixels",
      result: "320 CSS-pixel minimum-width check passed with no page overflow",
    },
  });
  // A 720 CSS-pixel viewport models desktop 200% zoom reflow at 1440px.
  await page.setViewportSize({ height: 450, width: 720 });
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "Requester",
    scenario: "Requester populated Actions Taken at the 200% CSS reflow proxy",
    state: "requester-actions-populated-css-reflow-200-percent",
    stateSource: "natural",
    zoom: {
      mode: "css-reflow-200-percent",
      result: "720 CSS-pixel reflow proxy passed with no page overflow",
    },
  });
  if (requesterViewport) {
    await page.setViewportSize(requesterViewport);
  }
  await checkNativePageScale(page, testInfo, {
    role: "Requester",
    scenario:
      "Requester populated Actions Taken at native Chromium 200% page scale",
    state: "requester-actions-populated-native-page-scale-200-percent",
    stateSource: "natural",
  });

  await logOut(page);
  await signIn(page, "e2e-isolation@example.test");
  const foreign = await page.request.get(
    `${apiUrl}/api/tickets/${ticketId}/actions`
  );
  expect(foreign.status()).toBe(404);
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.getByText(description, { exact: true })).toHaveCount(0);
});

test("uncertain create retries its original request without duplicates", async ({
  page,
}, testInfo) => {
  const ticketId = await createTicket(page, testInfo);
  await signIn(page, "e2e-staff@example.test");
  await page.goto(`/tickets/${ticketId}`);
  const section = actionSection(page);
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill("Keep this draft after the response is lost.");
  let dropResponse = true;
  const requestIds: string[] = [];
  await page.route(`**/api/tickets/${ticketId}/actions`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const body = asRecord(route.request().postDataJSON() as unknown);
    if (typeof body.requestId !== "string") {
      throw new TypeError("Expected an action request ID.");
    }
    requestIds.push(body.requestId);
    if (dropResponse) {
      dropResponse = false;
      const saved = await route.fetch();
      expect(saved.status()).toBe(201);
      await route.abort("connectionfailed");
      return;
    }
    await route.continue();
  });
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByText("The request may have succeeded.", { exact: true })
  ).toBeVisible();
  await expect(
    section.getByRole("textbox", { exact: true, name: "Action Description" })
  ).toHaveValue("Keep this draft after the response is lost.");
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Uncertain action create retains a recoverable draft",
    state: "action-create-uncertain-draft",
    stateSource: "intercepted",
  });
  await section.getByRole("button", { name: /Retry/u }).click();
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByText("Keep this draft after the response is lost.", {
      exact: true,
    })
  ).toBeVisible();
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
  const response = await page.request.get(
    `${apiUrl}/api/tickets/${ticketId}/actions`
  );
  const body = asRecord((await response.json()) as unknown);
  expect(body.totalItems).toBe(1);
});

test("stale Ticket conflict keeps the draft until refresh and explicit retry", async ({
  page,
}, testInfo) => {
  const ticketId = await createTicket(page, testInfo);
  await signIn(page, "e2e-staff@example.test");
  await page.goto(`/tickets/${ticketId}`);
  const section = actionSection(page);
  await section
    .getByRole("button", { exact: true, name: "Add Action Taken" })
    .click();
  await section
    .getByRole("textbox", { exact: true, name: "Action Description" })
    .fill("Keep this draft after a concurrent create.");
  const sessionResponse = await page.request.get(`${apiUrl}/api/auth/me`);
  const session = asRecord((await sessionResponse.json()) as unknown);
  if (typeof session.csrfToken !== "string") {
    throw new TypeError("Expected a CSRF token.");
  }
  const concurrent = await page.request.post(
    `${apiUrl}/api/tickets/${ticketId}/actions`,
    {
      data: {
        description: "Concurrent Planned action",
        followUpRequired: false,
        requestId: crypto.randomUUID(),
        version: 1,
      },
      headers: { Origin: origin, "X-CSRF-Token": session.csrfToken },
    }
  );
  expect(concurrent.status()).toBe(201);
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByText(
      "This Ticket changed while the action was being created. Refresh the latest Ticket and review your draft.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    section.getByRole("textbox", { exact: true, name: "Action Description" })
  ).toHaveValue("Keep this draft after a concurrent create.");
  await checkLayout(page);
  await capture(page, testInfo, {
    role: "IT Staff",
    scenario: "Version conflict preserves the recoverable action draft",
    state: "action-conflict-draft",
    stateSource: "natural",
  });
  await section.getByRole("button", { name: "Refresh latest Ticket" }).click();
  await expect(
    section.getByText("Ticket version 2", { exact: true })
  ).toBeVisible();
  await section
    .getByRole("button", { exact: true, name: "Save Action Taken" })
    .click();
  await expect(
    section.getByText("Keep this draft after a concurrent create.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(section.getByText("2 action(s)", { exact: true })).toBeVisible();
});
