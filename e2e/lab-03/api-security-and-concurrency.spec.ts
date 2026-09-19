import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test } from "@playwright/test";
import type {
  APIRequestContext,
  APIResponse,
  Browser,
  BrowserContext,
  Page,
} from "@playwright/test";

// oxlint-disable no-await-in-loop -- Status setup and boundary assertions intentionally preserve causal versions.
// oxlint-disable unicorn/no-await-expression-member -- Response JSON is read at the assertion site to keep each boundary explicit.
// oxlint-disable no-shadow -- Route paths are intentionally named path at each HTTP assertion site.

const apiOrigin = process.env.E2E_API_URL ?? "http://localhost:3000";
const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const password = "correct horse battery staple";

type JsonObject = Record<string, unknown>;
type Role = "Requester" | "IT Staff" | "Administrator";

interface ApiSession {
  context: BrowserContext;
  csrfToken: string;
  request: APIRequestContext;
  user: {
    email: string;
    id: number;
    role: Role;
  };
}

interface TicketReference {
  id: number;
  version: number;
}

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown, label: string): JsonObject => {
  if (!isJsonObject(value)) {
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

const getRole = (object: JsonObject, key: string): Role => {
  const value = getString(object, key);
  if (
    value !== "Requester" &&
    value !== "IT Staff" &&
    value !== "Administrator"
  ) {
    throw new TypeError(`Unexpected role ${value}.`);
  }

  return value;
};

const readJson = async (response: APIResponse): Promise<JsonObject> =>
  asJsonObject(await response.json(), "API response");

const expectApiError = async (
  response: APIResponse,
  status: number,
  code: string
): Promise<void> => {
  expect(response.status()).toBe(status);
  const body = await readJson(response);
  expect(getString(asJsonObject(body.error, "error"), "code")).toBe(code);
};

const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login$/u);
};

const openSession = async (
  browser: Browser,
  email: string
): Promise<ApiSession> => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email);

  const { request } = context;
  const response = await request.get(`${apiOrigin}/api/auth/me`);
  expect(response.status()).toBe(200);
  const body = await readJson(response);
  const user = asJsonObject(body.user, "current user");

  return {
    context,
    csrfToken: getString(body, "csrfToken"),
    request,
    user: {
      email: getString(user, "email"),
      id: getNumber(user, "id"),
      role: getRole(user, "role"),
    },
  };
};

const closeSessions = async (
  sessions: readonly (ApiSession | undefined)[]
): Promise<void> => {
  await Promise.all(
    sessions
      .filter((session): session is ApiSession => session !== undefined)
      .map(async (session) => {
        await session.context.close();
      })
  );
};

const resetBoundaryTickets = (): void => {
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@toktickit/server",
      "exec",
      "tsx",
      "scripts/reset-e2e-tickets.ts",
    ],
    {
      cwd: path.resolve(import.meta.dirname, "../.."),
      stdio: "pipe",
    }
  );
};

const api = async (
  session: ApiSession,
  method: string,
  path: string,
  options: {
    body?: unknown;
    csrf?: string;
    origin?: string;
    query?: Record<string, string | number>;
  } = {}
): Promise<APIResponse> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: options.origin ?? appOrigin,
  };

  if (options.csrf !== "none") {
    headers["X-CSRF-Token"] = options.csrf ?? session.csrfToken;
  }

  return await session.request.fetch(`${apiOrigin}${path}`, {
    data: options.body,
    failOnStatusCode: false,
    headers,
    method,
    params: options.query,
  });
};

const createTicket = async (
  requester: ApiSession,
  uniqueId: string
): Promise<TicketReference> => {
  const categoriesResponse = await api(requester, "GET", "/api/categories");
  const systemsResponse = await api(requester, "GET", "/api/related-systems");
  expect(categoriesResponse.status()).toBe(200);
  expect(systemsResponse.status()).toBe(200);
  const categoryItems = (await readJson(categoriesResponse)).items;
  const systemItems = (await readJson(systemsResponse)).items;
  if (!Array.isArray(categoryItems) || !Array.isArray(systemItems)) {
    throw new TypeError("Expected reference data arrays.");
  }

  const category = asJsonObject(categoryItems[0], "category");
  const relatedSystem = asJsonObject(systemItems[0], "related system");
  const response = await requester.request.post(`${apiOrigin}/api/tickets`, {
    failOnStatusCode: false,
    headers: {
      Accept: "application/json",
      Origin: appOrigin,
      "X-CSRF-Token": requester.csrfToken,
    },
    multipart: {
      categoryId: String(getNumber(category, "id")),
      description: `E2E boundary ticket ${uniqueId}`,
      relatedSystemId: String(getNumber(relatedSystem, "id")),
      requestedPriority: "Low",
      summary: `E2E boundary ${uniqueId}`,
    },
  });
  expect(response.status()).toBe(201);
  const ticket = asJsonObject(
    (await readJson(response)).ticket,
    "created Ticket"
  );

  return {
    id: getNumber(ticket, "id"),
    version: getNumber(ticket, "version"),
  };
};

test("covers every role boundary for protected reads and writes", async ({
  browser,
}) => {
  let requester: ApiSession | undefined;
  let staff: ApiSession | undefined;
  let admin: ApiSession | undefined;

  try {
    requester = await openSession(browser, "e2e-desktop@example.test");
    staff = await openSession(browser, "e2e-staff@example.test");
    admin = await openSession(browser, "e2e-admin@example.test");
    const ticket = await createTicket(
      requester,
      `role-matrix-${Date.now()}-${test.info().workerIndex}`
    );

    const roles = [
      ["Requester", requester] as const,
      ["IT Staff", staff] as const,
      ["Administrator", admin] as const,
    ];

    for (const [role, session] of roles) {
      for (const [path, expectedStatus] of [
        ["/api/categories", 200],
        ["/api/related-systems", 200],
      ] as const) {
        const response = await api(session, "GET", path);
        expect(response.status(), `${role} ${path}`).toBe(expectedStatus);
      }
    }

    expect((await api(requester, "GET", "/api/tickets")).status()).toBe(200);
    for (const session of [staff, admin]) {
      await expectApiError(
        await api(session, "GET", "/api/tickets"),
        403,
        "FORBIDDEN"
      );
      await expectApiError(
        await api(session, "POST", "/api/tickets", { body: {} }),
        403,
        "FORBIDDEN"
      );
    }
    for (const session of [requester, staff]) {
      await expectApiError(
        await api(session, "GET", `/api/users/${admin.user.id}`),
        403,
        "FORBIDDEN"
      );
    }
    expect(
      (await api(admin, "GET", `/api/users/${admin.user.id}`)).status()
    ).toBe(200);

    for (const [role, session] of [["Requester", requester]] as const) {
      for (const path of [
        "/api/staff/tickets",
        "/api/staff/owners",
        "/api/users",
      ]) {
        await expectApiError(await api(session, "GET", path), 403, "FORBIDDEN");
        expect(role).toBe("Requester");
      }
    }

    for (const session of [staff, admin]) {
      for (const path of ["/api/staff/tickets", "/api/staff/owners"]) {
        const response = await api(session, "GET", path);
        expect(response.status()).toBe(200);
      }
    }
    expect((await api(admin, "GET", "/api/users")).status()).toBe(200);

    await expectApiError(
      await api(staff, "GET", "/api/users"),
      403,
      "FORBIDDEN"
    );

    const ownedDetailPaths = [
      `/api/tickets/${ticket.id}`,
      `/api/tickets/${ticket.id}/attachments`,
      `/api/tickets/${ticket.id}/comments`,
    ];
    for (const session of [requester, staff, admin]) {
      for (const path of ownedDetailPaths) {
        const response = await api(session, "GET", path);
        expect(response.status(), `${session.user.role} ${path}`).toBe(200);
      }
    }

    await expectApiError(
      await api(requester, "GET", `/api/tickets/${ticket.id}/internal-notes`),
      403,
      "FORBIDDEN"
    );
    for (const session of [staff, admin]) {
      expect(
        (
          await api(session, "GET", `/api/tickets/${ticket.id}/internal-notes`)
        ).status()
      ).toBe(200);
    }

    const protectedWrites: readonly [string, string, unknown][] = [
      ["POST", `/api/tickets/${ticket.id}/claim`, { version: ticket.version }],
      [
        "PUT",
        `/api/tickets/${ticket.id}/owner`,
        { ownerId: null, version: ticket.version },
      ],
      [
        "PATCH",
        `/api/tickets/${ticket.id}/it-priority`,
        { itPriority: "Low", version: ticket.version },
      ],
      [
        "POST",
        `/api/tickets/${ticket.id}/status`,
        { currentStatus: "Open", version: ticket.version },
      ],
      ["POST", `/api/tickets/${ticket.id}/internal-notes`, { content: "x" }],
    ];

    for (const [method, path, body] of protectedWrites) {
      await expectApiError(
        await api(requester, method, path, { body }),
        403,
        "FORBIDDEN"
      );
    }
    await expectApiError(
      await api(admin, "POST", `/api/tickets/${ticket.id}/comments`, {
        body: { content: "Administrator read-only boundary" },
      }),
      403,
      "FORBIDDEN"
    );
    await expectApiError(
      await api(admin, "POST", `/api/tickets/${ticket.id}/internal-notes`, {
        body: { content: "Administrator read-only boundary" },
      }),
      403,
      "FORBIDDEN"
    );

    expect(
      (
        await api(requester, "POST", `/api/tickets/${ticket.id}/comments`, {
          body: { content: "Requester write is allowed." },
        })
      ).status()
    ).toBe(201);
    expect(
      (
        await api(
          requester,
          "PUT",
          `/api/tickets/${ticket.id}/resolution-indication`,
          { body: {} }
        )
      ).status()
    ).toBe(200);

    const nonRequesterWrite = await api(
      staff,
      "PUT",
      `/api/tickets/${ticket.id}/resolution-indication`,
      { body: {} }
    );
    await expectApiError(nonRequesterWrite, 403, "FORBIDDEN");
  } finally {
    await closeSessions([requester, staff, admin]);
    resetBoundaryTickets();
  }
});

test("enforces CSRF, origin, session-cookie, and safe-error boundaries", async ({
  browser,
}) => {
  let requester: ApiSession | undefined;
  try {
    requester = await openSession(browser, "e2e-desktop@example.test");
    const ticket = await createTicket(
      requester,
      `security-${Date.now()}-${test.info().workerIndex}`
    );

    const cookies = await requester.context.cookies();
    const sessionCookie = cookies.find(
      (cookie) => cookie.name === "toktickit_session"
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");
    expect(sessionCookie?.secure).toBe(false);

    const authResponse = await api(requester, "GET", "/api/auth/me");
    const authBody = await readJson(authResponse);
    expect(authBody).not.toHaveProperty("passwordHash");
    expect(asJsonObject(authBody.user, "auth user")).not.toHaveProperty(
      "passwordHash"
    );
    expect(getString(authBody, "csrfToken")).toMatch(/^[A-Za-z0-9_-]{43}$/u);

    await expectApiError(
      await api(
        requester,
        "PUT",
        `/api/tickets/${ticket.id}/resolution-indication`,
        {
          body: {},
          csrf: "none",
        }
      ),
      403,
      "CSRF_INVALID"
    );
    await expectApiError(
      await api(
        requester,
        "PUT",
        `/api/tickets/${ticket.id}/resolution-indication`,
        {
          body: {},
          csrf: "wrong-token",
        }
      ),
      403,
      "CSRF_INVALID"
    );
    await expectApiError(
      await api(
        requester,
        "PUT",
        `/api/tickets/${ticket.id}/resolution-indication`,
        {
          body: {},
          origin: "https://evil.example.test",
        }
      ),
      403,
      "ORIGIN_FORBIDDEN"
    );

    const invalidLogin = await requester.request.post(
      `${apiOrigin}/api/auth/login`,
      {
        data: { email: "e2e-desktop@example.test", password },
        failOnStatusCode: false,
        headers: { Origin: "https://evil.example.test" },
      }
    );
    await expectApiError(invalidLogin, 403, "ORIGIN_FORBIDDEN");

    const foreign = await openSession(browser, "e2e-isolation@example.test");
    try {
      await expectApiError(
        await api(foreign, "GET", `/api/tickets/${ticket.id}`),
        404,
        "RESOURCE_NOT_FOUND"
      );
      await expectApiError(
        await api(foreign, "GET", `/api/tickets/${ticket.id}/comments`),
        404,
        "RESOURCE_NOT_FOUND"
      );
      await expectApiError(
        await api(
          foreign,
          "PUT",
          `/api/tickets/${ticket.id}/resolution-indication`,
          {
            body: {},
          }
        ),
        404,
        "RESOURCE_NOT_FOUND"
      );
    } finally {
      await closeSessions([foreign]);
    }
  } finally {
    await closeSessions([requester]);
    resetBoundaryTickets();
  }
});

test("keeps concurrent claims single-winner and preserves concurrent comments", async ({
  browser,
}) => {
  let requester: ApiSession | undefined;
  let firstStaff: ApiSession | undefined;
  let secondStaff: ApiSession | undefined;
  try {
    requester = await openSession(browser, "e2e-desktop@example.test");
    firstStaff = await openSession(browser, "e2e-staff@example.test");
    secondStaff = await openSession(browser, "e2e-staff-second@example.test");
    if (firstStaff === undefined || secondStaff === undefined) {
      throw new Error("Concurrent staff sessions were not initialized.");
    }
    const ticket = await createTicket(
      requester,
      `race-${Date.now()}-${test.info().workerIndex}`
    );

    const claimResponses = await Promise.all(
      [firstStaff, secondStaff].map(
        async (session) =>
          await api(session, "POST", `/api/tickets/${ticket.id}/claim`, {
            body: { version: ticket.version },
          })
      )
    );
    const claimStatuses = claimResponses
      .map((response) => response.status())
      .toSorted((left, right) => left - right);
    expect(claimStatuses).toEqual([200, 409]);
    const conflict = claimResponses.find(
      (response) => response.status() === 409
    );
    if (conflict === undefined) {
      throw new Error("Concurrent claim did not produce a conflict response.");
    }
    const conflictBody = await readJson(conflict);
    expect(["ASSIGNMENT_CONFLICT", "VERSION_CONFLICT"]).toContain(
      getString(asJsonObject(conflictBody.error, "claim conflict"), "code")
    );

    const successfulClaim = claimResponses.find(
      (response) => response.status() === 200
    );
    if (successfulClaim === undefined) {
      throw new Error("Concurrent claim did not produce a success response.");
    }
    const successfulClaimBody = await readJson(successfulClaim);
    const successfulOwner = asJsonObject(
      successfulClaimBody.owner,
      "successful claim owner"
    );
    const winningStaffId = getNumber(successfulOwner, "id");
    const winningStaff = [firstStaff, secondStaff].find(
      (session) => session.user.id === winningStaffId
    );
    if (winningStaff === undefined) {
      throw new Error("Successful claim owner was not one of the contenders.");
    }
    const observingStaff =
      winningStaff === firstStaff ? secondStaff : firstStaff;

    const detail = await api(
      observingStaff,
      "GET",
      `/api/tickets/${ticket.id}`
    );
    expect(detail.status()).toBe(200);
    const detailBody = await readJson(detail);
    const claimed = asJsonObject(detailBody, "claimed Ticket");
    expect(asJsonObject(claimed.owner, "Ticket owner")).toHaveProperty(
      "id",
      winningStaffId
    );

    const commentResponses = await Promise.all(
      ["concurrent comment one", "concurrent comment two"].map(
        async (content) =>
          await api(
            winningStaff,
            "POST",
            `/api/tickets/${ticket.id}/comments`,
            {
              body: { content },
            }
          )
      )
    );
    expect(commentResponses.map((response) => response.status())).toEqual([
      201, 201,
    ]);
    const commentsResponse = await api(
      observingStaff,
      "GET",
      `/api/tickets/${ticket.id}/comments`
    );
    expect(commentsResponse.status()).toBe(200);
    const { comments } = await readJson(commentsResponse);
    if (!Array.isArray(comments)) {
      throw new TypeError("Expected comments array after concurrent writes.");
    }
    expect(
      comments.map((comment) =>
        getString(asJsonObject(comment, "comment"), "content")
      )
    ).toEqual(
      expect.arrayContaining([
        "concurrent comment one",
        "concurrent comment two",
      ])
    );
  } finally {
    await closeSessions([requester, firstStaff, secondStaff]);
    resetBoundaryTickets();
  }
});

test("covers the complete status lifecycle, confirmation, and stale-version edges", async ({
  browser,
}) => {
  let requester: ApiSession | undefined;
  let staff: ApiSession | undefined;

  try {
    requester = await openSession(browser, "e2e-desktop@example.test");
    staff = await openSession(browser, "e2e-staff@example.test");
    if (staff === undefined) {
      throw new Error("Lifecycle staff session was not initialized.");
    }
    const activeStaff = staff;
    const ticket = await createTicket(
      requester,
      `lifecycle-${Date.now()}-${test.info().workerIndex}`
    );

    const claim = await api(
      activeStaff,
      "POST",
      `/api/tickets/${ticket.id}/claim`,
      {
        body: { version: ticket.version },
      }
    );
    expect(claim.status()).toBe(200);
    let current = await readJson(claim);
    expect(getString(current, "currentStatus")).toBe("New");
    expect(getNumber(current, "version")).toBe(ticket.version + 1);

    const applyStatus = async (
      currentStatus: string,
      confirmed = false
    ): Promise<JsonObject> => {
      const response = await api(
        activeStaff,
        "POST",
        `/api/tickets/${ticket.id}/status`,
        {
          body: {
            currentStatus,
            version: getNumber(current, "version"),
            ...(confirmed ? { confirmed: true } : {}),
          },
        }
      );
      expect(response.status(), `transition to ${currentStatus}`).toBe(200);
      const next = await readJson(response);
      expect(getString(next, "currentStatus")).toBe(currentStatus);
      expect(getNumber(next, "version")).toBe(
        getNumber(current, "version") + 1
      );
      current = next;
      return next;
    };

    await applyStatus("Open");
    await applyStatus("In Progress");
    await applyStatus("Waiting for Requester");
    await applyStatus("In Progress");

    await expectApiError(
      await api(activeStaff, "POST", `/api/tickets/${ticket.id}/status`, {
        body: {
          currentStatus: "Resolved",
          version: getNumber(current, "version"),
        },
      }),
      400,
      "CONFIRMATION_REQUIRED"
    );

    await applyStatus("Resolved", true);
    await applyStatus("Reopened");
    await applyStatus("In Progress");
    await applyStatus("Resolved", true);
    await applyStatus("Closed", true);

    await expectApiError(
      await api(activeStaff, "POST", `/api/tickets/${ticket.id}/status`, {
        body: {
          confirmed: true,
          currentStatus: "Reopened",
          version: getNumber(current, "version"),
        },
      }),
      409,
      "INVALID_TRANSITION"
    );
    await expectApiError(
      await api(activeStaff, "POST", `/api/tickets/${ticket.id}/status`, {
        body: {
          confirmed: true,
          currentStatus: "Closed",
          version: getNumber(current, "version") - 1,
        },
      }),
      409,
      "VERSION_CONFLICT"
    );
  } finally {
    await closeSessions([requester, staff]);
    resetBoundaryTickets();
  }
});

test("covers every current-status and next-status pair through the live API", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The exhaustive status pair matrix runs once in the desktop project."
  );
  test.setTimeout(180_000);

  const statuses = [
    "New",
    "Open",
    "In Progress",
    "Waiting for Requester",
    "Resolved",
    "Closed",
    "Reopened",
    "Cancelled",
  ] as const;
  const paths: Record<(typeof statuses)[number], readonly string[]> = {
    Cancelled: ["Cancelled"],
    Closed: ["Open", "In Progress", "Resolved", "Closed"],
    "In Progress": ["Open", "In Progress"],
    New: [],
    Open: ["Open"],
    Reopened: ["Open", "In Progress", "Resolved", "Reopened"],
    Resolved: ["Open", "In Progress", "Resolved"],
    "Waiting for Requester": ["Open", "Waiting for Requester"],
  };
  const allowed: Record<
    (typeof statuses)[number],
    readonly (typeof statuses)[number][]
  > = {
    Cancelled: [],
    Closed: [],
    "In Progress": ["Waiting for Requester", "Resolved", "Cancelled"],
    New: ["Open", "Cancelled"],
    Open: ["In Progress", "Waiting for Requester", "Cancelled"],
    Reopened: ["Open", "In Progress", "Cancelled"],
    Resolved: ["Closed", "Reopened"],
    "Waiting for Requester": ["In Progress", "Resolved", "Cancelled"],
  };
  const terminal = new Set(["Resolved", "Closed", "Cancelled"]);
  let requester: ApiSession | undefined;
  let staff: ApiSession | undefined;

  try {
    requester = await openSession(browser, "e2e-desktop@example.test");
    staff = await openSession(browser, "e2e-staff@example.test");
    if (staff === undefined) {
      throw new Error("Status matrix staff session was not initialized.");
    }
    const activeStaff = staff;

    for (const currentStatus of statuses) {
      for (const nextStatus of statuses) {
        const ticket = await createTicket(
          requester,
          `status-matrix-${currentStatus}-${nextStatus}-${Date.now()}`
        );
        const claim = await api(
          activeStaff,
          "POST",
          `/api/tickets/${ticket.id}/claim`,
          { body: { version: ticket.version } }
        );
        expect(claim.status()).toBe(200);
        let version = getNumber(await readJson(claim), "version");

        for (const pathStatus of paths[currentStatus]) {
          const response = await api(
            activeStaff,
            "POST",
            `/api/tickets/${ticket.id}/status`,
            {
              body: {
                currentStatus: pathStatus,
                version,
                ...(terminal.has(pathStatus) ? { confirmed: true } : {}),
              },
            }
          );
          expect(response.status(), `setup ${currentStatus}`).toBe(200);
          version = getNumber(await readJson(response), "version");
        }

        const response = await api(
          activeStaff,
          "POST",
          `/api/tickets/${ticket.id}/status`,
          {
            body: {
              currentStatus: nextStatus,
              version,
              ...(terminal.has(nextStatus) ? { confirmed: true } : {}),
            },
          }
        );
        if (allowed[currentStatus].includes(nextStatus)) {
          expect(response.status(), `${currentStatus} -> ${nextStatus}`).toBe(
            200
          );
          const transitioned = await readJson(response);
          expect(getString(transitioned, "currentStatus")).toBe(nextStatus);
        } else {
          await expectApiError(response, 409, "INVALID_TRANSITION");
        }
      }
    }
  } finally {
    await closeSessions([requester, staff]);
    resetBoundaryTickets();
  }
});

test("keeps internal notes private while preserving staff and Administrator reads", async ({
  browser,
}) => {
  let requester: ApiSession | undefined;
  let staff: ApiSession | undefined;
  let admin: ApiSession | undefined;

  try {
    requester = await openSession(browser, "e2e-desktop@example.test");
    staff = await openSession(browser, "e2e-staff@example.test");
    admin = await openSession(browser, "e2e-admin@example.test");
    const ticket = await createTicket(
      requester,
      `note-privacy-${Date.now()}-${test.info().workerIndex}`
    );
    const privateContent = `private boundary ${Date.now()}`;
    const createNote = await api(
      staff,
      "POST",
      `/api/tickets/${ticket.id}/internal-notes`,
      { body: { content: privateContent } }
    );
    expect(createNote.status()).toBe(201);

    for (const session of [staff, admin]) {
      const notes = await api(
        session,
        "GET",
        `/api/tickets/${ticket.id}/internal-notes`
      );
      expect(notes.status()).toBe(200);
      expect(JSON.stringify(await readJson(notes))).toContain(privateContent);
    }

    await expectApiError(
      await api(requester, "GET", `/api/tickets/${ticket.id}/internal-notes`),
      403,
      "FORBIDDEN"
    );
    const requesterDetail = await api(
      requester,
      "GET",
      `/api/tickets/${ticket.id}`
    );
    expect(requesterDetail.status()).toBe(200);
    expect(JSON.stringify(await readJson(requesterDetail))).not.toContain(
      privateContent
    );
  } finally {
    await closeSessions([requester, staff, admin]);
    resetBoundaryTickets();
  }
});

test("serializes duplicate account creation and revokes concurrent target sessions", async ({
  browser,
}) => {
  let admin: ApiSession | undefined;
  let secondAdmin: ApiSession | undefined;
  let target: ApiSession | undefined;

  try {
    admin = await openSession(browser, "e2e-admin@example.test");
    secondAdmin = await openSession(browser, "e2e-admin@example.test");
    const raceEmail = `e2e-race-${Date.now()}-${test.info().workerIndex}-${test.info().project.name}@example.test`;
    const raceBody = {
      displayName: "E2E Concurrent Account",
      email: raceEmail,
      initialPassword: password,
      isActive: true,
      role: "Requester",
    };
    const createResponses = await Promise.all(
      [admin, secondAdmin, admin, secondAdmin].map(
        async (session) =>
          await api(session, "POST", "/api/users", { body: raceBody })
      )
    );
    expect(
      createResponses.filter((response) => response.status() === 201)
    ).toHaveLength(1);
    expect(
      createResponses.filter((response) => response.status() === 409)
    ).toHaveLength(3);
    for (const response of createResponses) {
      if (response.status() === 409) {
        await expectApiError(response, 409, "EMAIL_CONFLICT");
      }
    }

    const targetEmail = `e2e-session-${Date.now()}-${test.info().workerIndex}-${test.info().project.name}@example.test`;
    const targetResponse = await api(admin, "POST", "/api/users", {
      body: {
        displayName: "E2E Revocation Target",
        email: targetEmail,
        initialPassword: password,
        isActive: true,
        role: "Requester",
      },
    });
    expect(targetResponse.status()).toBe(201);
    const targetUser = asJsonObject(
      (await readJson(targetResponse)).user,
      "created revocation target"
    );
    const targetId = getNumber(targetUser, "id");
    target = await openSession(browser, targetEmail);

    const updates = await Promise.all([
      api(admin, "PATCH", `/api/users/${targetId}`, {
        body: { role: "IT Staff" },
      }),
      api(secondAdmin, "PATCH", `/api/users/${targetId}`, {
        body: { isActive: false },
      }),
    ]);
    expect(
      updates
        .map((response) => response.status())
        .toSorted((left, right) => left - right)
    ).toEqual([200, 200]);

    const finalUser = await api(admin, "GET", `/api/users/${targetId}`);
    expect(finalUser.status()).toBe(200);
    const finalUserBody = await readJson(finalUser);
    const finalUserRecord = asJsonObject(finalUserBody, "final target");
    expect(finalUserRecord).toMatchObject({
      email: targetEmail,
      isActive: false,
      role: "IT Staff",
    });
    await expectApiError(
      await api(target, "GET", "/api/auth/me"),
      401,
      "AUTHENTICATION_REQUIRED"
    );
  } finally {
    await closeSessions([admin, secondAdmin, target]);
  }
});

test("verifies populated-schema migration preservation and collision safety", ({
  browser: _browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The database migration gate runs once in the desktop project."
  );

  const output = execFileSync(
    "pnpm",
    [
      "--filter",
      "@toktickit/server",
      "exec",
      "tsx",
      "scripts/check-migration-preservation.ts",
    ],
    {
      cwd: path.resolve(import.meta.dirname, "../.."),
      encoding: "utf-8",
      env: process.env,
      timeout: 120_000,
    }
  );
  expect(output).toContain(
    "Migration preservation passed: legacy rows survived and normalized-email collisions aborted."
  );
});
