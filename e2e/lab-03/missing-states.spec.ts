import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import { captureLab3Evidence } from "./evidence.js";

const password = "correct horse battery staple";
const origin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const apiOrigin = process.env.E2E_API_URL ?? "http://localhost:3000";

const createDeferred = () => {
  let release!: () => void;
  // oxlint-disable-next-line promise/avoid-new -- Route gate controls a browser loading state.
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, resolve: release };
};

const errorBody = (code: string, message: string): string =>
  JSON.stringify({ error: { code, message } });

const corsHeaders = async (route: Route): Promise<Record<string, string>> => ({
  "access-control-allow-credentials": "true",
  "access-control-allow-origin":
    (await route.request().headerValue("origin")) ?? origin,
  "content-type": "application/json",
});

const signIn = async (page: Page, email: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

test("captures authentication validation, inactive, busy, and rate-limit states", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-admin@example.test");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("wrong horse battery staple");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign-in failed.");
  await captureLab3Evidence(page, testInfo, {
    directory: "authentication",
    name: "invalid-credentials.png",
    role: "Anonymous",
    scenario: "Invalid credentials safe failure",
    stateSource: "natural",
  });

  await page.reload();
  await page.getByLabel("Email").fill("e2e-inactive@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "This account is inactive. Contact your administrator."
  );
  await captureLab3Evidence(page, testInfo, {
    directory: "authentication",
    name: "inactive-account.png",
    role: "Anonymous",
    scenario: "Inactive account safe failure",
    stateSource: "natural",
  });

  const busyGate = createDeferred();
  let holdBusyRequest = true;
  const busyRoute = async (route: Route) => {
    if (holdBusyRequest && route.request().method() === "POST") {
      holdBusyRequest = false;
      await busyGate.promise;
      await route.fulfill({
        body: errorBody("INTERNAL_ERROR", "Unable to complete the request."),
        headers: await corsHeaders(route),
        status: 500,
      });
      return;
    }

    await route.continue();
  };

  await page.route("**/api/auth/login", busyRoute);
  await page.reload();
  await page.getByLabel("Email").fill("e2e-admin@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("button", { name: "Signing in…" })
  ).toBeDisabled();
  await captureLab3Evidence(page, testInfo, {
    directory: "authentication",
    name: "login-busy.png",
    role: "Anonymous",
    scenario: "Login busy state",
    stateSource: "intercepted",
  });
  busyGate.resolve();
  await expect(page.getByRole("alert")).toContainText("Sign-in failed.");
  await page.unroute("**/api/auth/login", busyRoute);

  const rateLimitRoute = async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        body: errorBody(
          "RATE_LIMITED",
          "Too many sign-in attempts. Try again later."
        ),
        headers: {
          ...(await corsHeaders(route)),
          "retry-after": "30",
        },
        status: 429,
      });
      return;
    }

    await route.continue();
  };

  await page.route("**/api/auth/login", rateLimitRoute);
  await page.reload();
  await page.getByLabel("Email").fill("e2e-admin@example.test");
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText(
    /Try again in \d+ seconds?\./u
  );
  await expect(page.getByLabel("Email")).toBeDisabled();
  await captureLab3Evidence(page, testInfo, {
    directory: "authentication",
    name: "login-rate-limited.png",
    role: "Anonymous",
    scenario: "Login rate-limit feedback",
    stateSource: "intercepted",
  });
  await page.unroute("**/api/auth/login", rateLimitRoute);
});

test("captures shared queue empty, no-results, loading, and failure states", async ({
  page,
}, testInfo) => {
  await signIn(page, "e2e-staff@example.test");

  type QueueMode = "empty" | "failure" | "live" | "loading";
  let mode: QueueMode = "empty";
  let loadingGate = createDeferred();
  const queueRoute = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    if (mode === "empty") {
      await route.fulfill({
        body: JSON.stringify({
          items: [],
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 0,
        }),
        headers: await corsHeaders(route),
        status: 200,
      });
      return;
    }

    if (mode === "failure") {
      await route.abort("failed");
      return;
    }

    if (mode === "loading") {
      await loadingGate.promise;
      mode = "live";
    }

    await route.continue();
  };

  await page.route("**/api/staff/tickets**", queueRoute);
  await page.goto("/staff/tickets");
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No Tickets in the queue" })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-queue",
    name: "empty.png",
    role: "IT Staff",
    scenario: "Empty shared Ticket Queue",
    stateSource: "intercepted",
  });

  await page.getByLabel("Search", { exact: true }).fill("missing-ticket");
  await page.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching Tickets" })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-queue",
    name: "no-results.png",
    role: "IT Staff",
    scenario: "Filtered queue no-results state",
    stateSource: "intercepted",
  });

  mode = "loading";
  loadingGate = createDeferred();
  const reloadPromise = page.reload();
  await expect(page.getByText("Loading the Ticket Queue…")).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-queue",
    name: "loading.png",
    role: "IT Staff",
    scenario: "Queue loading state",
    stateSource: "intercepted",
  });
  loadingGate.resolve();
  await reloadPromise;
  await expect(
    page.getByRole("heading", { name: "Ticket Queue" })
  ).toBeVisible();

  mode = "failure";
  const failureReloadPromise = page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Could not load the Ticket Queue."
  );
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-queue",
    name: "failure.png",
    role: "IT Staff",
    scenario: "Queue API failure with retry",
    stateSource: "intercepted",
  });
  await failureReloadPromise;

  mode = "live";
  await page.unroute("**/api/staff/tickets**", queueRoute);
  await page.getByRole("button", { exact: true, name: "Retry" }).click();
  await expect(
    page.getByRole("link", { exact: true, name: "TKT-20260901-NEW001" })
  ).toBeVisible();
});

test("captures Staff Ticket Detail failure and forbidden states", async ({
  page,
}, testInfo) => {
  await signIn(page, "e2e-staff@example.test");
  await page.goto("/staff/tickets");
  const ticketLink = page.getByRole("link", {
    name: "TKT-20260901-NEW001",
  });
  const ticketHref = await ticketLink.getAttribute("href");
  if (ticketHref === null) {
    throw new Error("The seeded queue Ticket did not include a detail link.");
  }
  const ticketId = ticketHref.split("/").pop();
  if (ticketId === undefined) {
    throw new Error("The seeded queue Ticket did not include an ID.");
  }

  type DetailMode = "failure" | "forbidden";
  let mode: DetailMode = "failure";
  const detailRoutePattern = new RegExp(
    `/api/tickets/${ticketId}(?:\\?.*)?$`,
    "u"
  );
  const detailRoute = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    if (mode === "failure") {
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      body: errorBody(
        "FORBIDDEN",
        "You do not have permission to access this Ticket."
      ),
      headers: await corsHeaders(route),
      status: 403,
    });
  };

  await page.route(detailRoutePattern, detailRoute);
  await page.goto(ticketHref);
  await expect(
    page.getByRole("heading", { name: "Ticket unavailable" })
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to connect to the TokTickIT API"
  );
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-ticket-detail",
    name: "api-failure.png",
    role: "IT Staff",
    scenario: "Ticket Detail API failure with retry",
    stateSource: "intercepted",
  });

  mode = "forbidden";
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Access denied" })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "staff-ticket-detail",
    name: "forbidden.png",
    role: "IT Staff",
    scenario: "Ticket Detail forbidden state",
    stateSource: "intercepted",
  });
  await page.unroute(detailRoutePattern, detailRoute);
});

test("captures User Management empty, no-results, failure, validation, and guard states", async ({
  page,
}, testInfo) => {
  await signIn(page, "e2e-admin@example.test");
  // Warm the split route before installing API fixtures. This keeps the
  // evidence test focused on UI states instead of first-request Vite timing.
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "User accounts" })
  ).toBeVisible();

  type UserListMode = "empty" | "failure" | "live" | "loading";
  let mode: UserListMode = "loading";
  const loadingGate = createDeferred();
  const userListRoute = async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    if (mode === "loading") {
      await loadingGate.promise;
      mode = "empty";
    }

    if (mode === "empty") {
      await route.fulfill({
        body: JSON.stringify({ items: [] }),
        headers: await corsHeaders(route),
        status: 200,
      });
      return;
    }

    if (mode === "failure") {
      await route.abort("failed");
      return;
    }

    await route.continue();
  };

  await page.route(`${apiOrigin}/api/users**`, userListRoute);
  const loadingReloadPromise = page.reload();
  await expect(page.getByText("Loading users…")).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "loading.png",
    role: "Administrator",
    scenario: "User Management loading state",
    stateSource: "intercepted",
  });
  loadingGate.resolve();
  await loadingReloadPromise;
  await expect(
    page.getByRole("heading", { name: "No user accounts yet" })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "empty.png",
    role: "Administrator",
    scenario: "Empty User Management directory",
    stateSource: "intercepted",
  });

  await page
    .getByRole("searchbox", { name: "Search name or email" })
    .fill("missing-user");
  await page.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(
    page.getByRole("heading", { name: "No matching users" })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "no-results.png",
    role: "Administrator",
    scenario: "Filtered User Management no-results state",
    stateSource: "intercepted",
  });

  mode = "failure";
  const failureReloadPromise = page.reload();
  await expect(page.getByRole("alert")).toContainText("Unable to load users.");
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "failure.png",
    role: "Administrator",
    scenario: "User Management API failure with retry",
    stateSource: "intercepted",
  });
  await failureReloadPromise;
  mode = "live";
  await page.unroute(`${apiOrigin}/api/users**`, userListRoute);
  await page.getByRole("button", { exact: true, name: "Retry" }).click();
  await expect(
    page
      .locator(".user-table-wrap:visible, .user-cards:visible")
      .getByText("E2E Administrator", { exact: true })
      .first()
  ).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Create User" }).click();
  await page.getByRole("button", { exact: true, name: "Save User" }).click();
  await expect(page.getByText(/Name must contain/u)).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "validation.png",
    role: "Administrator",
    scenario: "User Management required-field validation",
    stateSource: "natural",
  });

  const savingGate = createDeferred();
  const createBusyRoute = async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await savingGate.promise;
    await route.fulfill({
      body: errorBody("INTERNAL_ERROR", "Unable to save user account."),
      headers: await corsHeaders(route),
      status: 500,
    });
  };

  await page.route(`${apiOrigin}/api/users`, createBusyRoute);
  await page.getByLabel(/^Name/u).fill("Saving E2E User");
  await page.getByLabel(/^Email/u).fill("saving-e2e@example.test");
  await page.locator("#user-role").selectOption("Requester");
  await page.getByLabel(/^Initial password/u).fill("saving account phrase");
  await page.getByRole("button", { exact: true, name: "Save User" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Saving…" })
  ).toBeDisabled();
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "saving.png",
    role: "Administrator",
    scenario: "User Management saving state",
    stateSource: "intercepted",
  });
  savingGate.resolve();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to save user account."
  );
  await page.unroute(`${apiOrigin}/api/users`, createBusyRoute);

  await page.getByLabel(/^Name/u).fill("Duplicate E2E User");
  await page.getByLabel(/^Email/u).fill("e2e-admin@example.test");
  await page.locator("#user-role").selectOption("Requester");
  await page.getByLabel(/^Initial password/u).fill("duplicate account phrase");
  await page.getByRole("button", { exact: true, name: "Save User" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "That email address is already in use"
  );
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "duplicate-email.png",
    role: "Administrator",
    scenario: "User Management duplicate email conflict",
    stateSource: "natural",
  });
  await page.getByRole("button", { exact: true, name: "Cancel" }).click();

  await page
    .locator('button[aria-label="Edit E2E Administrator"]:visible')
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit E2E Administrator" })
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Active account" }).uncheck();

  let guardCode = "SELF_DEACTIVATION";
  const guardRoutePattern = /\/api\/users\/\d+$/u;
  const guardRoute = async (route: Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        body: errorBody(guardCode, "Account safety rule blocked this update."),
        headers: await corsHeaders(route),
        status: 409,
      });
      return;
    }

    await route.continue();
  };

  await page.route(guardRoutePattern, guardRoute);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "You cannot deactivate your own Administrator account."
  );
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "self-deactivation-blocked.png",
    role: "Administrator",
    scenario: "Administrator self-deactivation protection",
    stateSource: "intercepted",
  });

  guardCode = "LAST_ADMIN_REQUIRED";
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "At least one active Administrator account must remain."
  );
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "last-admin-blocked.png",
    role: "Administrator",
    scenario: "Last active Administrator protection",
    stateSource: "intercepted",
  });
  await page.unroute(guardRoutePattern, guardRoute);
  await page.getByRole("button", { exact: true, name: "Cancel" }).click();
});

test("blocks User Management for a non-Administrator", async ({
  page,
}, testInfo) => {
  await signIn(page, "e2e-desktop@example.test");
  await page.goto("/users");
  await expect(
    page.getByRole("heading", { name: "Access denied" })
  ).toBeVisible();
  await captureLab3Evidence(page, testInfo, {
    directory: "user-management",
    name: "non-admin-forbidden.png",
    role: "Requester",
    scenario: "Requester denied Administrator User Management",
    stateSource: "natural",
  });
});
