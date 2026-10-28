import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

const password = "correct horse battery staple";
const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");
const screenshotsRoot = path.join(
  repositoryRoot,
  "artifacts",
  "lab-04",
  "screenshots",
  "staff-dashboard"
);
const evidenceCommand =
  "E2E_CLIENT_PORT=5279 E2E_API_URL=http://localhost:3079 VITE_API_URL=http://localhost:3079 pnpm --filter @toktickit/e2e exec playwright test lab-04/staff-dashboard-evidence.spec.ts";

type ViewportName = "desktop" | "tablet" | "mobile";
type ZoomMode =
  | "default"
  | "minimum-width-320-css-pixels"
  | "css-reflow-200-percent"
  | "native-page-scale-200-percent";

interface CaptureRecord {
  path: string;
  role: string;
  scenario: string;
  viewport: { height: number; width: number };
  zoom: ZoomMode;
}

const accounts = [
  { email: "e2e-staff@example.test", role: "IT Staff", slug: "staff" },
  { email: "e2e-admin@example.test", role: "Administrator", slug: "admin" },
] as const;

const viewportByProject = new Map<string, ViewportName>([
  ["desktop-chromium", "desktop"],
  ["tablet-chromium", "tablet"],
  ["mobile-chromium", "mobile"],
]);

// 320 CSS px is the minimum width; 720 CSS px stands in for 1440 px at 200%.
const reflowWidths = [
  { width: 1440, zoom: "default" },
  { width: 768, zoom: "default" },
  { width: 390, zoom: "default" },
  { width: 320, zoom: "minimum-width-320-css-pixels" },
  { width: 720, zoom: "css-reflow-200-percent" },
] as const;

const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/u);
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
};

const expectNoAxeViolations = async (page: Page): Promise<void> => {
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
};

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const origin =
  process.env.E2E_BASE_URL ??
  `http://localhost:${process.env.E2E_CLIENT_PORT ?? "5173"}`;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected an object response.");
  }
  return Object.fromEntries(Object.entries(value));
};

const getJson = async (
  page: Page,
  url: string
): Promise<Record<string, unknown>> => {
  const response = await page.request.get(url);
  expect(response.status()).toBe(200);
  return asRecord(await response.json());
};

// Seeded staff accounts have no pending work, so add Planned Actions to show a populated My Actions list.
const addPlannedActions = async (page: Page, count: number): Promise<void> => {
  const session = await getJson(page, `${apiUrl}/api/auth/me`);
  const headers = { Origin: origin, "X-CSRF-Token": String(session.csrfToken) };
  const queue = await getJson(page, `${apiUrl}/api/staff/tickets?scope=active`);
  const items = Array.isArray(queue.items) ? queue.items : [];
  const ticketId = Number(asRecord(items[0]).id);
  // oxlint-disable no-await-in-loop -- Each create needs the version the previous one returned.
  for (let index = 0; index < count; index += 1) {
    const ticket = await getJson(page, `${apiUrl}/api/tickets/${ticketId}`);
    const version = Number(
      "ticket" in ticket ? asRecord(ticket.ticket).version : ticket.version
    );
    const response = await page.request.post(
      `${apiUrl}/api/tickets/${ticketId}/actions`,
      {
        data: {
          description: `Dashboard evidence action ${Date.now()}-${index}`,
          followUpRequired: false,
          requestId: crypto.randomUUID(),
          version,
        },
        headers,
      }
    );
    expect(response.status()).toBe(201);
  }
  // oxlint-enable no-await-in-loop
};

const gitOutput = (args: string[]): string =>
  execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf-8" }).trim();

for (const account of accounts) {
  test(`${account.role} dashboard, Queue drill-down, and My Actions pass axe, reflow, and visual checks`, async ({
    page,
  }, testInfo) => {
    const projectViewport = viewportByProject.get(testInfo.project.name);
    const initialViewport = page.viewportSize();
    if (projectViewport === undefined || initialViewport === null) {
      throw new Error(`Unexpected project: ${testInfo.project.name}`);
    }
    const isDesktop = projectViewport === "desktop";
    const files: CaptureRecord[] = [];
    await mkdir(screenshotsRoot, { recursive: true });

    const capture = async (
      name: string,
      scenario: string,
      zoom: ZoomMode,
      target: Page = page
    ): Promise<void> => {
      const absolutePath = path.join(screenshotsRoot, `${name}.png`);
      await target.screenshot({ fullPage: true, path: absolutePath });
      const viewport = target.viewportSize() ?? initialViewport;
      files.push({
        path: path.relative(repositoryRoot, absolutePath),
        role: account.role,
        scenario,
        viewport,
        zoom,
      });
    };

    // Check one loaded page at every width, then restore the project viewport.
    const checkPage = async (pageName: string, scenario: string) => {
      // oxlint-disable no-await-in-loop -- Resize and check each width in order.
      for (const { width, zoom } of reflowWidths) {
        await page.setViewportSize({ height: initialViewport.height, width });
        await expectNoHorizontalOverflow(page);
        if (width === 1440 || width === 320) {
          await expectNoAxeViolations(page);
        }
        if (isDesktop && zoom !== "default") {
          await capture(
            `${account.slug}-${pageName}-${zoom}`,
            `${scenario} at ${width} CSS px`,
            zoom
          );
        }
      }
      // oxlint-enable no-await-in-loop
      await page.setViewportSize(initialViewport);
      await capture(
        `${account.slug}-${pageName}-${projectViewport}`,
        scenario,
        "default"
      );
      if (isDesktop) {
        const cdpSession = await page.context().newCDPSession(page);
        try {
          await cdpSession.send("Emulation.setPageScaleFactor", {
            pageScaleFactor: 2,
          });
          await expect
            .poll(
              async () => await page.evaluate(() => visualViewport?.scale ?? 0)
            )
            .toBe(2);
          await expectNoHorizontalOverflow(page);
        } finally {
          await cdpSession.send("Emulation.resetPageScaleFactor");
        }
      }
    };

    await signIn(page, account.email);
    await addPlannedActions(page, 2);
    await page.reload();
    const metrics = page.getByLabel("Ticket metrics");
    await expect(metrics).toBeVisible();
    await checkPage(
      "dashboard",
      `${account.role} dashboard with seeded counts`
    );

    const unassignedCard = metrics.getByRole("link", {
      name: /^Active Unassigned: \d+$/u,
    });
    const cardName = (await unassignedCard.getAttribute("aria-label")) ?? "";
    const cardCount = cardName.slice(cardName.lastIndexOf(" ") + 1);
    await unassignedCard.click();
    await expect(page.locator(".result-count")).toHaveText(
      `${cardCount} total`
    );
    await checkPage(
      "queue-unassigned",
      `${account.role} Active Unassigned Queue drill-down`
    );

    await page.goto("/staff/actions");
    await expect(
      page.getByRole("heading", { exact: true, name: "My Actions" })
    ).toBeVisible();
    await expect(
      page.getByText(/^Dashboard evidence action /u).first()
    ).toBeVisible();
    await checkPage("my-actions", `${account.role} My Actions list`);

    if (account.slug === "staff") {
      await page.route("**/api/staff/dashboard", async (route) => {
        await route.abort();
      });
      await page.goto("/dashboard");
      await expect(
        page.getByText(
          "Could not load your dashboard. Check your connection and try again."
        )
      ).toBeVisible();
      await expectNoAxeViolations(page);
      await expectNoHorizontalOverflow(page);
      await capture(
        `staff-dashboard-error-${projectViewport}`,
        "Recoverable dashboard network failure with retry option",
        "default"
      );
      await page.unroute("**/api/staff/dashboard");

      // Each state opens in its own tab so the intercepted response never leaks.
      const openStatePage = async (): Promise<Page> => {
        const statePage = await page.context().newPage();
        await statePage.setViewportSize(initialViewport);
        return statePage;
      };
      const generatedAt = new Date();
      const emptyDashboard = {
        counts: {
          activeByPriority: { High: 0, Low: 0, Medium: 0, Urgent: 0 },
          activeOwned: 0,
          activeUnassigned: 0,
          byStatus: {
            Cancelled: 0,
            Closed: 0,
            "In Progress": 0,
            New: 0,
            Open: 0,
            Reopened: 0,
            Resolved: 0,
            "Waiting for Requester": 0,
          },
          myActions: 0,
        },
        generatedAt: generatedAt.toISOString(),
        previews: {
          myActions: [],
          recentlyUpdatedTickets: [],
          urgentActiveTickets: [],
        },
        window: {
          from: new Date(
            generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          through: generatedAt.toISOString(),
        },
      };

      const emptyPage = await openStatePage();
      await emptyPage.route("**/api/staff/dashboard", async (route) => {
        await route.fulfill({
          body: JSON.stringify(emptyDashboard),
          contentType: "application/json",
          status: 200,
        });
      });
      await emptyPage.goto("/dashboard");
      await expect(
        emptyPage.getByText("No active Urgent Tickets right now.")
      ).toBeVisible();
      await expectNoAxeViolations(emptyPage);
      await expectNoHorizontalOverflow(emptyPage);
      await capture(
        `staff-dashboard-empty-${projectViewport}`,
        "Dashboard with zero counts and empty previews (intercepted response)",
        "default",
        emptyPage
      );
      await emptyPage.close();

      const loadingPage = await openStatePage();
      let pendingRoute: Route | undefined;
      await loadingPage.route("**/api/staff/dashboard", (route) => {
        pendingRoute = route;
      });
      await loadingPage.goto("/dashboard");
      await expect(
        loadingPage.getByText("Loading your dashboard…")
      ).toBeVisible();
      await expectNoAxeViolations(loadingPage);
      await expectNoHorizontalOverflow(loadingPage);
      await capture(
        `staff-dashboard-loading-${projectViewport}`,
        "Dashboard loading while its API response is pending (held request)",
        "default",
        loadingPage
      );
      if (pendingRoute === undefined) {
        throw new Error("Expected the dashboard request to remain pending.");
      }
      await pendingRoute.fulfill({
        body: JSON.stringify(emptyDashboard),
        contentType: "application/json",
        status: 200,
      });
      await loadingPage.close();

      const forbiddenPage = await openStatePage();
      await forbiddenPage.route("**/api/staff/dashboard", async (route) => {
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
      await expectNoAxeViolations(forbiddenPage);
      await expectNoHorizontalOverflow(forbiddenPage);
      await capture(
        `staff-dashboard-forbidden-${projectViewport}`,
        "Dashboard safe forbidden response without retry (intercepted 403)",
        "default",
        forbiddenPage
      );
      await forbiddenPage.close();
    }

    const status = gitOutput([
      "status",
      "--porcelain",
      "--untracked-files=all",
    ]);
    await writeFile(
      path.join(
        screenshotsRoot,
        `manifest-${account.slug}-${projectViewport}.json`
      ),
      `${JSON.stringify(
        {
          branch: gitOutput(["branch", "--show-current"]),
          command: evidenceCommand,
          commit: gitOutput(["rev-parse", "HEAD"]),
          files,
          generatedAt: new Date().toISOString(),
          project: testInfo.project.name,
          sourceDirty: status
            .split("\n")
            .some(
              (line) =>
                line.length > 0 &&
                !line.includes("artifacts/lab-04/screenshots/staff-dashboard/")
            ),
        },
        null,
        2
      )}\n`
    );
  });
}
