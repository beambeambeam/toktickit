import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, Route, TestInfo } from "@playwright/test";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const origin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const password = "correct horse battery staple";
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const screenshotsRoot = path.join(
  repositoryRoot,
  "artifacts",
  "lab-04",
  "screenshots",
  "requester-dashboard"
);
const evidenceCommand =
  "E2E_CLIENT_PORT=5278 E2E_API_URL=http://localhost:3078 E2E_BASE_URL=http://localhost:5278 PORT=3078 CORS_ORIGIN=http://localhost:5278 API_ORIGIN=http://localhost:3078 VITE_API_URL=http://localhost:3078 pnpm --filter @toktickit/e2e exec playwright test lab-04/requester-dashboard.spec.ts";

type ViewportName = "desktop" | "tablet" | "mobile";
type StateSource = "intercepted" | "natural";
type ZoomMode =
  | "default"
  | "minimum-width-320-css-pixels"
  | "css-reflow-200-percent"
  | "native-page-scale-200-percent";

interface CaptureRecord {
  capturedAt: string;
  path: string;
  review: { style: string; visual: string };
  role: "Requester";
  scenario: string;
  stateSource: StateSource;
  viewport: { height: number; name: ViewportName; width: number };
  zoom: { mode: ZoomMode; result: string };
}

interface CaptureOptions {
  name: string;
  scenario: string;
  stateSource: StateSource;
  viewport?: { height: number; name: ViewportName; width: number };
  zoom?: { mode: ZoomMode; result: string };
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

const viewportByProject = new Map<string, CaptureRecord["viewport"]>([
  ["desktop-chromium", { height: 900, name: "desktop", width: 1440 }],
  ["tablet-chromium", { height: 1024, name: "tablet", width: 768 }],
  ["mobile-chromium", { height: 844, name: "mobile", width: 390 }],
]);

const captureScreenshot = async (
  page: Page,
  options: CaptureOptions,
  viewport: CaptureRecord["viewport"],
  files: CaptureRecord[]
) => {
  const absolutePath = path.join(screenshotsRoot, options.name);
  await mkdir(screenshotsRoot, { recursive: true });
  await page.screenshot({ fullPage: true, path: absolutePath });
  files.push({
    capturedAt: new Date().toISOString(),
    path: path.relative(repositoryRoot, absolutePath),
    review: {
      style: "docs/lab-04/tests.md#style-02",
      visual: "docs/lab-04/tests.md#vis-02",
    },
    role: "Requester",
    scenario: options.scenario,
    stateSource: options.stateSource,
    viewport: options.viewport ?? viewport,
    zoom: options.zoom ?? {
      mode: "default",
      result: `Default project viewport ${viewport.width}×${viewport.height}`,
    },
  });
};

const writeEvidenceManifest = async (
  testInfo: TestInfo,
  files: CaptureRecord[],
  viewportName: ViewportName
) => {
  const status = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: repositoryRoot, encoding: "utf-8" }
  );
  const sourceDirty = status
    .split("\n")
    .some(
      (line) =>
        line.length > 0 &&
        !line.includes("artifacts/lab-04/screenshots/requester-dashboard/")
    );
  const manifest: EvidenceManifest = {
    branch: execFileSync("git", ["branch", "--show-current"], {
      cwd: repositoryRoot,
      encoding: "utf-8",
    }).trim(),
    command: evidenceCommand,
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf-8",
    }).trim(),
    files,
    generatedAt: new Date().toISOString(),
    project: testInfo.project.name,
    sourceDirty,
  };
  await writeFile(
    path.join(screenshotsRoot, `manifest-${viewportName}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
};

interface TicketRef {
  id: number;
  version: number;
}

interface DashboardResponse {
  counts: {
    activeTickets: number;
    recentlyResolved: number;
    recentlyUpdated: number;
    waitingForRequester: number;
  };
  generatedAt: string;
  previews: {
    recentlyResolved: unknown[];
    recentlyUpdated: unknown[];
  };
  window: { from: string; through: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new TypeError("Expected an object response.");
  }
  return value;
};

const getString = (object: Record<string, unknown>, field: string): string => {
  const value = object[field];
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${field} to be a string.`);
  }
  return value;
};

const getNumber = (object: Record<string, unknown>, field: string): number => {
  const value = object[field];
  if (typeof value !== "number") {
    throw new TypeError(`Expected ${field} to be a number.`);
  }
  return value;
};

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected an array response.");
  }
  return value.map(asRecord);
};

const dashboardFrom = (value: unknown): DashboardResponse => {
  const object = asRecord(value);
  const counts = asRecord(object.counts);
  const window = asRecord(object.window);
  return {
    counts: {
      activeTickets: getNumber(counts, "activeTickets"),
      recentlyResolved: getNumber(counts, "recentlyResolved"),
      recentlyUpdated: getNumber(counts, "recentlyUpdated"),
      waitingForRequester: getNumber(counts, "waitingForRequester"),
    },
    generatedAt: getString(object, "generatedAt"),
    previews: {
      recentlyResolved: asRecordArray(
        asRecord(object.previews).recentlyResolved
      ),
      recentlyUpdated: asRecordArray(asRecord(object.previews).recentlyUpdated),
    },
    window: {
      from: getString(window, "from"),
      through: getString(window, "through"),
    },
  };
};

const ticketRefFrom = (value: unknown): TicketRef => {
  const object = asRecord(value);
  const ticket = "ticket" in object ? asRecord(object.ticket) : object;
  if (typeof ticket.id !== "number" || typeof ticket.version !== "number") {
    throw new TypeError("Expected a Ticket ID and version.");
  }
  return { id: ticket.id, version: ticket.version };
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

const getCsrfToken = async (page: Page): Promise<string> => {
  const response = await page.request.get(`${apiUrl}/api/auth/me`);
  expect(response.status()).toBe(200);
  const body = asRecord(await response.json());
  if (typeof body.csrfToken !== "string") {
    throw new TypeError("Expected a CSRF token.");
  }
  return body.csrfToken;
};

const createTicket = async (
  page: Page,
  summary: string
): Promise<TicketRef> => {
  const csrfToken = await getCsrfToken(page);
  const response = await page.request.post(`${apiUrl}/api/tickets`, {
    headers: { Origin: origin, "X-CSRF-Token": csrfToken },
    multipart: {
      categoryId: "1",
      description: "Requester dashboard browser test fixture.",
      relatedSystemId: "1",
      requestedPriority: "Medium",
      summary,
    },
  });
  expect(response.status()).toBe(201);
  return ticketRefFrom(await response.json());
};

const resolveTicketForDashboard = async (page: Page, ticket: TicketRef) => {
  const csrfToken = await getCsrfToken(page);
  const headers = { Origin: origin, "X-CSRF-Token": csrfToken };
  const claim = await page.request.post(
    `${apiUrl}/api/tickets/${ticket.id}/claim`,
    { data: { version: ticket.version }, headers }
  );
  expect(claim.status()).toBe(200);
  let currentTicket = ticketRefFrom(await claim.json());

  // oxlint-disable no-await-in-loop -- Each status write returns the version for the next transition.
  for (const currentStatus of ["Open", "In Progress", "Resolved"] as const) {
    const response = await page.request.post(
      `${apiUrl}/api/tickets/${ticket.id}/status`,
      {
        data: {
          confirmed: currentStatus === "Resolved" ? true : undefined,
          currentStatus,
          version: currentTicket.version,
        },
        headers,
      }
    );
    expect(response.status()).toBe(200);
    currentTicket = ticketRefFrom(await response.json());
  }
  // oxlint-enable no-await-in-loop
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
};

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

test("Requester dashboard scopes exact metrics, drill-downs, and previews", async ({
  browser,
  page,
}, testInfo) => {
  const projectViewport = viewportByProject.get(testInfo.project.name);
  if (projectViewport === undefined) {
    throw new Error(`Unexpected Playwright project: ${testInfo.project.name}`);
  }
  const dashboardEmail = `e2e-dashboard-${projectViewport.name}@example.test`;
  const foreignEmail = `e2e-dashboard-foreign-${projectViewport.name}@example.test`;
  const fixtureSuffix = `${projectViewport.name} ${Date.now()}`;
  const activeSummary = `E2E requester dashboard active ${fixtureSuffix}`;
  const resolvedSummary = `E2E requester dashboard resolved ${fixtureSuffix}`;
  const foreignSummary = `E2E requester dashboard foreign ${fixtureSuffix}`;

  await signIn(page, dashboardEmail);
  await createTicket(page, activeSummary);
  const resolvedTicket = await createTicket(page, resolvedSummary);

  const staffContext = await browser.newContext({ baseURL: origin });
  const staffPage = await staffContext.newPage();
  await signIn(staffPage, "e2e-staff@example.test");
  await resolveTicketForDashboard(staffPage, resolvedTicket);
  await staffContext.close();

  const foreignContext = await browser.newContext({ baseURL: origin });
  const foreignPage = await foreignContext.newPage();
  await signIn(foreignPage, foreignEmail);
  await createTicket(foreignPage, foreignSummary);
  await foreignContext.close();

  const gotoDashboard = async (): Promise<DashboardResponse> => {
    const responsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith("/api/requester/dashboard")
    );
    await page.goto("/dashboard");
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    return dashboardFrom(await response.json());
  };

  const dashboard = await gotoDashboard();
  expect(dashboard.counts.activeTickets).toBe(1);
  expect(dashboard.counts.waitingForRequester).toBe(0);
  expect(dashboard.counts.recentlyUpdated).toBe(2);
  expect(dashboard.counts.recentlyResolved).toBe(1);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/Asia\/Bangkok/u).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh dashboard" })
  ).toBeEnabled();
  await expect(page.getByText(foreignSummary)).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Recently Updated" }).getByRole("link", {
      name: new RegExp(escapeRegExp(activeSummary), "u"),
    })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recently Resolved" }).getByRole("link", {
      name: new RegExp(escapeRegExp(resolvedSummary), "u"),
    })
  ).toBeVisible();

  await page.keyboard.press("Tab");
  const focusedElement = page.locator(":focus");
  await expect(focusedElement).toHaveCount(1);
  const focusOutline = await focusedElement.evaluate(
    (element) => getComputedStyle(element).outlineStyle
  );
  expect(focusOutline).not.toBe("none");

  const initialViewport = page.viewportSize();
  if (initialViewport === null) {
    throw new Error("Expected the dashboard page to have a viewport.");
  }
  const capturedFiles: CaptureRecord[] = [];
  const viewports = [
    { height: 900, name: "desktop", width: 1440 },
    { height: 1024, name: "tablet", width: 768 },
    { height: 844, name: "mobile", width: 390 },
    { height: 844, name: "minimum", width: 320 },
    { height: 844, name: "zoom-200-proxy", width: 720 },
  ] as const;
  // oxlint-disable no-await-in-loop -- Resize and capture each viewport in order.
  for (const viewport of viewports) {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await expectNoHorizontalOverflow(page);
    if (viewport.name === "desktop" || viewport.name === "minimum") {
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    }
    if (viewport.name === projectViewport.name) {
      await captureScreenshot(
        page,
        {
          name: `requester-dashboard-populated-${viewport.name}.png`,
          scenario: "Requester dashboard with counts and recent previews",
          stateSource: "natural",
        },
        projectViewport,
        capturedFiles
      );
    }
    if (
      testInfo.project.name === "desktop-chromium" &&
      viewport.name === "minimum"
    ) {
      await captureScreenshot(
        page,
        {
          name: "requester-dashboard-minimum-width-320.png",
          scenario: "Populated dashboard at the 320 CSS pixel minimum width",
          stateSource: "natural",
          viewport: { height: 844, name: "desktop", width: 320 },
          zoom: {
            mode: "minimum-width-320-css-pixels",
            result:
              "320 CSS pixel viewport passed without page-wide horizontal overflow",
          },
        },
        projectViewport,
        capturedFiles
      );
    }
    if (
      testInfo.project.name === "desktop-chromium" &&
      viewport.name === "zoom-200-proxy"
    ) {
      await captureScreenshot(
        page,
        {
          name: "requester-dashboard-css-reflow-200-percent.png",
          scenario:
            "Populated dashboard at the 720 CSS pixel 200% reflow proxy",
          stateSource: "natural",
          viewport: { height: 844, name: "desktop", width: 720 },
          zoom: {
            mode: "css-reflow-200-percent",
            result:
              "720 CSS pixel reflow proxy passed without page-wide horizontal overflow",
          },
        },
        projectViewport,
        capturedFiles
      );
    }
  }
  // oxlint-enable no-await-in-loop
  await page.setViewportSize(initialViewport);

  const recentUpdatedCard = page.getByRole("link", {
    name: /^Recently Updated:/u,
  });
  const updatedHref = await recentUpdatedCard.getAttribute("href");
  if (updatedHref === null) {
    throw new Error("Expected the Recently Updated link to include its URL.");
  }
  const updatedUrl = new URL(updatedHref, origin);
  expect(updatedUrl.searchParams.get("scope")).toBe("recently-updated");
  expect(updatedUrl.searchParams.get("from")).toBe(dashboard.window.from);
  expect(updatedUrl.searchParams.get("through")).toBe(dashboard.window.through);

  const updatedResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/tickets" &&
      url.searchParams.get("scope") === "recently-updated"
    );
  });
  await recentUpdatedCard.click();
  const updatedResponse = await updatedResponsePromise;
  const updatedRequestUrl = new URL(updatedResponse.url());
  expect(updatedRequestUrl.searchParams.get("from")).toBe(
    dashboard.window.from
  );
  expect(updatedRequestUrl.searchParams.get("through")).toBe(
    dashboard.window.through
  );
  const updatedList = asRecord(await updatedResponse.json());
  const updatedItems = asRecordArray(updatedList.items);
  const updatedSummaries = updatedItems.map((item) => item.summary);
  expect(getNumber(updatedList, "totalItems")).toBe(
    dashboard.counts.recentlyUpdated
  );
  expect(updatedSummaries).toContain(activeSummary);
  expect(updatedSummaries).toContain(resolvedSummary);
  expect(updatedSummaries).not.toContain(foreignSummary);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(
    page.getByRole("button", { name: /Clear Filters/u })
  ).toBeEnabled();
  await expect(page.getByText(/recently updated tickets/u)).toBeVisible();
  await captureScreenshot(
    page,
    {
      name: `requester-dashboard-drilldown-${projectViewport.name}.png`,
      scenario: "Recently Updated My Tickets list with exact generated bounds",
      stateSource: "natural",
    },
    projectViewport,
    capturedFiles
  );

  const resolvedDashboard = await gotoDashboard();
  const resolvedCard = page.getByRole("link", {
    name: /^Recently Resolved:/u,
  });
  const resolvedHref = await resolvedCard.getAttribute("href");
  if (resolvedHref === null) {
    throw new Error("Expected the Recently Resolved link to include its URL.");
  }
  const resolvedUrl = new URL(resolvedHref, origin);
  expect(resolvedUrl.searchParams.get("scope")).toBe("recently-resolved");
  expect(resolvedUrl.searchParams.get("from")).toBe(
    resolvedDashboard.window.from
  );
  expect(resolvedUrl.searchParams.get("through")).toBe(
    resolvedDashboard.window.through
  );
  const resolvedResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/tickets" &&
      url.searchParams.get("scope") === "recently-resolved"
    );
  });
  await resolvedCard.click();
  const resolvedResponse = await resolvedResponsePromise;
  const resolvedRequestUrl = new URL(resolvedResponse.url());
  expect(resolvedRequestUrl.searchParams.get("from")).toBe(
    resolvedDashboard.window.from
  );
  expect(resolvedRequestUrl.searchParams.get("through")).toBe(
    resolvedDashboard.window.through
  );
  expect(resolvedRequestUrl.searchParams.get("sortBy")).toBe("resolvedAt");
  const resolvedList = asRecord(await resolvedResponse.json());
  const resolvedItems = asRecordArray(resolvedList.items);
  expect(getNumber(resolvedList, "totalItems")).toBe(
    resolvedDashboard.counts.recentlyResolved
  );
  expect(resolvedItems.map((item) => item.summary)).toContain(resolvedSummary);
  expect(resolvedItems.map((item) => item.summary)).not.toContain(
    foreignSummary
  );
  await expect(page.getByText(/recently resolved tickets/u)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Clear Filters/u })
  ).toBeEnabled();

  const clearedListPromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/tickets" && !url.searchParams.has("scope");
  });
  await page.getByRole("button", { name: /Clear Filters/u }).click();
  const clearedListResponse = await clearedListPromise;
  const clearedListUrl = new URL(clearedListResponse.url());
  expect(clearedListUrl.searchParams.has("scope")).toBe(false);
  expect(clearedListUrl.searchParams.has("from")).toBe(false);
  expect(clearedListUrl.searchParams.has("through")).toBe(false);
  await expect(page).toHaveURL(/\/tickets$/u);
  await expect(page.getByText(/recently resolved tickets/u)).toHaveCount(0);

  await gotoDashboard();
  await page
    .getByRole("region", { name: "Recently Updated" })
    .getByRole("link", {
      name: new RegExp(escapeRegExp(activeSummary), "u"),
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ticket Detail" })
  ).toBeVisible();
  await expect(page.getByText(activeSummary, { exact: true })).toBeVisible();

  await logOut(page);
  await signIn(page, foreignEmail);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("region", { name: "Recently Updated" }).getByRole("link", {
      name: new RegExp(escapeRegExp(foreignSummary), "u"),
    })
  ).toBeVisible();
  await expect(page.getByText(activeSummary)).toHaveCount(0);
  await expect(page.getByText(resolvedSummary)).toHaveCount(0);

  const capturePage = async (): Promise<Page> => {
    const statePage = await page.context().newPage();
    await statePage.setViewportSize(initialViewport);
    return statePage;
  };
  const captureWindowThrough = new Date();
  const emptyDashboard: DashboardResponse = {
    counts: {
      activeTickets: 0,
      recentlyResolved: 0,
      recentlyUpdated: 0,
      waitingForRequester: 0,
    },
    generatedAt: captureWindowThrough.toISOString(),
    previews: { recentlyResolved: [], recentlyUpdated: [] },
    window: {
      from: new Date(
        captureWindowThrough.getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      through: captureWindowThrough.toISOString(),
    },
  };
  const emptyPage = await capturePage();
  await emptyPage.route("**/api/requester/dashboard", async (route) => {
    await route.fulfill({
      body: JSON.stringify(emptyDashboard),
      contentType: "application/json",
      status: 200,
    });
  });
  await emptyPage.goto("/dashboard");
  await expect(
    emptyPage.getByText("No Tickets were updated in this seven-day window.")
  ).toBeVisible();
  await captureScreenshot(
    emptyPage,
    {
      name: `requester-dashboard-empty-${projectViewport.name}.png`,
      scenario: "Dashboard with zero counts and empty previews",
      stateSource: "intercepted",
    },
    projectViewport,
    capturedFiles
  );
  await emptyPage.close();

  const loadingPage = await capturePage();
  let loadingDashboardRoute: Route | undefined;
  await loadingPage.route("**/api/requester/dashboard", (route) => {
    loadingDashboardRoute = route;
  });
  await loadingPage.goto("/dashboard");
  await expect(loadingPage.getByText("Loading your dashboard…")).toBeVisible();
  await captureScreenshot(
    loadingPage,
    {
      name: `requester-dashboard-loading-${projectViewport.name}.png`,
      scenario: "Dashboard loading while its API response is pending",
      stateSource: "intercepted",
    },
    projectViewport,
    capturedFiles
  );
  if (loadingDashboardRoute === undefined) {
    throw new Error("Expected the dashboard request to remain pending.");
  }
  await loadingDashboardRoute.fulfill({
    body: JSON.stringify(emptyDashboard),
    contentType: "application/json",
    status: 200,
  });
  await loadingPage.close();

  const forbiddenPage = await capturePage();
  await forbiddenPage.route("**/api/requester/dashboard", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        error: { code: "FORBIDDEN", message: "Forbidden" },
      }),
      contentType: "application/json",
      status: 403,
    });
  });
  await forbiddenPage.goto("/dashboard");
  await expect(
    forbiddenPage.getByText(
      "You do not have permission to view this dashboard."
    )
  ).toBeVisible();
  await captureScreenshot(
    forbiddenPage,
    {
      name: `requester-dashboard-forbidden-${projectViewport.name}.png`,
      scenario: "Dashboard safe forbidden response with retry option",
      stateSource: "intercepted",
    },
    projectViewport,
    capturedFiles
  );
  await forbiddenPage.close();

  const failurePage = await capturePage();
  await failurePage.route("**/api/requester/dashboard", async (route) => {
    await route.abort();
  });
  await failurePage.goto("/dashboard");
  await expect(
    failurePage.getByText(
      "Could not load your dashboard. Check your connection and try again."
    )
  ).toBeVisible();
  await captureScreenshot(
    failurePage,
    {
      name: `requester-dashboard-error-${projectViewport.name}.png`,
      scenario: "Recoverable dashboard network failure with retry option",
      stateSource: "intercepted",
    },
    projectViewport,
    capturedFiles
  );
  await failurePage.close();

  if (testInfo.project.name === "desktop-chromium") {
    const cdpSession = await page.context().newCDPSession(page);
    try {
      await cdpSession.send("Emulation.setPageScaleFactor", {
        pageScaleFactor: 2,
      });
      await expect
        .poll(async () => await page.evaluate(() => visualViewport?.scale ?? 0))
        .toBe(2);
      await expectNoHorizontalOverflow(page);
      await captureScreenshot(
        page,
        {
          name: "requester-dashboard-native-page-scale-200-percent.png",
          scenario: "Requester dashboard at native Chromium page scale 200%",
          stateSource: "natural",
          zoom: {
            mode: "native-page-scale-200-percent",
            result:
              "Chromium visual viewport scale was 2 with no horizontal overflow",
          },
        },
        projectViewport,
        capturedFiles
      );
    } finally {
      await cdpSession.send("Emulation.resetPageScaleFactor");
    }
  }
  await writeEvidenceManifest(testInfo, capturedFiles, projectViewport.name);
});
