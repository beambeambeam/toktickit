import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  createUsersAdminFixture,
  TEST_ORIGIN,
} from "../helpers/users-admin-fixture.js";
import type {
  AuthenticatedFixtureSession,
  UsersAdminFixture,
} from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;
type TicketStatus =
  | "Cancelled"
  | "Closed"
  | "InProgress"
  | "New"
  | "Open"
  | "Reopened"
  | "Resolved"
  | "WaitingForRequester";
type TicketPriority = "High" | "Low" | "Medium" | "Urgent";
type ActionStatus = "Cancelled" | "Completed" | "InProgress" | "Planned";

const requesterEmail = "staff-dashboard-requester@example.test";
const staffEmail = "staff-dashboard-staff@example.test";
const adminEmail = "staff-dashboard-admin@example.test";
const otherStaffEmail = "staff-dashboard-other-staff@example.test";
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const sevenDaysMs = 7 * dayMs;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object.");
  }

  return value;
};

const asJsonArray = (value: unknown): JsonObject[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected a JSON array.");
  }

  return value.map(asJsonObject);
};

const getString = (object: JsonObject, field: string): string => {
  const value = object[field];
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${field} to be a string.`);
  }
  return value;
};

const fieldValues = (items: unknown, field: string): string[] =>
  asJsonArray(items).map((item) => getString(item, field));

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

const errorCode = (response: { body: unknown }): string => {
  const error = asJsonObject(asJsonObject(response.body).error);
  return getString(error, "code");
};

describe("Lab 4 staff dashboard API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let otherStaff: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let otherStaffId: number;
  let categoryId: number;
  let relatedSystemId: number;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }
    return fixture;
  };

  const createTicket = async (input: {
    currentStatus: TicketStatus;
    itPriority: TicketPriority;
    ownerId: number | null;
    resolvedAt?: Date;
    ticketNumber: string;
    updatedAt: Date;
  }) =>
    await getFixture().prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: input.currentStatus,
        description:
          "A Staff dashboard fixture Ticket with enough detail to read.",
        itPriority: input.itPriority,
        ownerId: input.ownerId,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        resolvedAt: input.resolvedAt ?? null,
        statusChangedAt: input.updatedAt,
        summary: `Staff dashboard ${input.ticketNumber}`,
        ticketDate: new Date(input.updatedAt.getTime() - dayMs),
        ticketNumber: input.ticketNumber,
        updatedAt: input.updatedAt,
      },
    });

  const createAction = async (input: {
    assigneeId: number;
    createdById: number;
    description: string;
    status: ActionStatus;
    ticketId: number;
    updatedAt: Date;
  }) =>
    await getFixture().prisma.actionTaken.create({
      data: {
        assigneeId: input.assigneeId,
        createdByUserId: input.createdById,
        description: input.description,
        payloadHash: "a".repeat(64),
        requestId: randomUUID(),
        status: input.status,
        ticketId: input.ticketId,
        updatedAt: input.updatedAt,
      },
    });

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    await activeFixture.reset();
    const requesterUser = await activeFixture.createUser({
      displayName: "Staff Dashboard Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Staff Dashboard IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Staff Dashboard Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const otherStaffUser = await activeFixture.createUser({
      displayName: "Staff Dashboard Other IT Staff",
      email: otherStaffEmail,
      role: "ITStaff",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Staff Dashboard Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Staff Dashboard System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    otherStaffId = otherStaffUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
    otherStaff = await activeFixture.authenticate(otherStaffEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("enforces staff role, authentication, and strict query scope for the dashboard", async () => {
    const { app } = getFixture();

    const unauthenticated = await request(app)
      .get("/api/staff/dashboard")
      .expect(401);
    assert.equal(errorCode(unauthenticated), "AUTHENTICATION_REQUIRED");

    const requesterResponse = await request(app)
      .get("/api/staff/dashboard")
      .set(authHeaders(requester))
      .expect(403);
    assert.equal(errorCode(requesterResponse), "FORBIDDEN");

    const staffResponse = await request(app)
      .get("/api/staff/dashboard")
      .set(authHeaders(staff))
      .expect(200);
    assert.ok(isJsonObject(staffResponse.body));

    const adminResponse = await request(app)
      .get("/api/staff/dashboard")
      .set(authHeaders(admin))
      .expect(200);
    assert.ok(isJsonObject(adminResponse.body));

    const unsupportedQueries = [
      "requesterId=1",
      "owner=me",
      "scope=active",
      "page=1",
      "scope=recently-updated&from=2026-10-04T04:00:00Z&through=2026-10-11T04:00:00Z",
    ];
    const invalidResponses = await Promise.all(
      unsupportedQueries.map((query) =>
        request(app)
          .get(`/api/staff/dashboard?${query}`)
          .set(authHeaders(staff))
      )
    );
    for (const invalid of invalidResponses) {
      assert.equal(invalid.status, 400);
      assert.equal(errorCode(invalid), "VALIDATION_ERROR");
    }
  });

  it("returns truthful zero-filled counts and empty previews when no Tickets exist", async () => {
    const response = await request(getFixture().app)
      .get("/api/staff/dashboard")
      .set(authHeaders(staff))
      .expect(200);
    const dashboard = asJsonObject(response.body);

    assert.deepEqual(asJsonObject(dashboard.counts), {
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
    });
    assert.deepEqual(asJsonObject(dashboard.previews), {
      myActions: [],
      recentlyUpdatedTickets: [],
      urgentActiveTickets: [],
    });
  });

  it("includes rows exactly at both window endpoints and excludes rows 1 ms outside", async () => {
    const through = new Date("2026-10-11T04:00:00.000Z");
    const from = new Date(through.getTime() - sevenDaysMs);
    const offsets = [
      ["TKT-BND-BEFORE-FROM", from.getTime() - 1],
      ["TKT-BND-AT-FROM", from.getTime()],
      ["TKT-BND-INSIDE", from.getTime() + 1],
      ["TKT-BND-AT-THROUGH", through.getTime()],
      ["TKT-BND-AFTER-THROUGH", through.getTime() + 1],
    ] as const;

    await Promise.all(
      offsets.map(
        async ([ticketNumber, time]) =>
          await createTicket({
            currentStatus: "New",
            itPriority: "Low",
            ownerId: null,
            ticketNumber,
            updatedAt: new Date(time),
          })
      )
    );

    // Import after the fixture sets DATABASE_URL so Prisma binds to the test database.
    const { findStaffDashboard } =
      await import("../../src/repositories/staff-dashboard.js");
    const dashboard = await findStaffDashboard(staffId, through);
    assert.equal(dashboard.window.from.toISOString(), from.toISOString());
    assert.equal(dashboard.window.through.toISOString(), through.toISOString());
    assert.deepEqual(
      dashboard.previews.recentlyUpdatedTickets.map(
        (ticket) => ticket.ticketNumber
      ),
      ["TKT-BND-AT-THROUGH", "TKT-BND-INSIDE", "TKT-BND-AT-FROM"]
    );
  });

  it("returns exact per-account counts, zero-filled maps, and capped previews", async () => {
    const activeFixture = getFixture();
    const now = Date.now();
    const at = (offsetMs: number) => new Date(now - offsetMs);

    // Active Tickets: DASH001-DASH006 window-bounded, DASH008 older than the window.
    const dash001 = await createTicket({
      currentStatus: "New",
      itPriority: "Urgent",
      ownerId: null,
      ticketNumber: "TKT-20261013-DASH001",
      updatedAt: at(1 * hourMs),
    });
    const dash002 = await createTicket({
      currentStatus: "Open",
      itPriority: "Low",
      ownerId: staffId,
      ticketNumber: "TKT-20261013-DASH002",
      updatedAt: at(2 * hourMs),
    });
    const dash003 = await createTicket({
      currentStatus: "InProgress",
      itPriority: "Urgent",
      ownerId: staffId,
      ticketNumber: "TKT-20261013-DASH003",
      updatedAt: at(3 * hourMs),
    });
    await createTicket({
      currentStatus: "WaitingForRequester",
      itPriority: "High",
      ownerId: null,
      ticketNumber: "TKT-20261013-DASH004",
      updatedAt: at(4 * hourMs),
    });
    await createTicket({
      currentStatus: "Reopened",
      itPriority: "Medium",
      ownerId: null,
      ticketNumber: "TKT-20261013-DASH005",
      updatedAt: at(5 * hourMs),
    });
    const dash006 = await createTicket({
      currentStatus: "Resolved",
      itPriority: "Low",
      ownerId: staffId,
      resolvedAt: at(10 * hourMs),
      ticketNumber: "TKT-20261013-DASH006",
      updatedAt: at(10 * hourMs),
    });
    await createTicket({
      currentStatus: "Closed",
      itPriority: "Medium",
      ownerId: null,
      ticketNumber: "TKT-20261013-DASH007",
      updatedAt: at(40 * dayMs),
    });
    const dash008 = await createTicket({
      currentStatus: "New",
      itPriority: "Urgent",
      ownerId: otherStaffId,
      ticketNumber: "TKT-20261013-DASH008",
      updatedAt: at(30 * dayMs),
    });

    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Action one",
      status: "Planned",
      ticketId: dash002.id,
      updatedAt: at(1 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Action two",
      status: "InProgress",
      ticketId: dash003.id,
      updatedAt: at(2 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: otherStaffId,
      description: "Action three",
      status: "Planned",
      ticketId: dash008.id,
      updatedAt: at(3 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Completed action excluded",
      status: "Completed",
      ticketId: dash002.id,
      updatedAt: at(30 * 60 * 1000),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Planned action on Resolved Ticket excluded",
      status: "Planned",
      ticketId: dash006.id,
      updatedAt: at(20 * 60 * 1000),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Cancelled action excluded",
      status: "Cancelled",
      ticketId: dash001.id,
      updatedAt: at(40 * 60 * 1000),
    });
    await createAction({
      assigneeId: otherStaffId,
      createdById: staffId,
      description: "Other assignee action excluded for staff",
      status: "Planned",
      ticketId: dash003.id,
      updatedAt: at(50 * 60 * 1000),
    });

    const response = await request(activeFixture.app)
      .get("/api/staff/dashboard")
      .set(authHeaders(staff))
      .expect(200);
    const dashboard = asJsonObject(response.body);

    assert.deepEqual(asJsonObject(dashboard.counts), {
      activeByPriority: { High: 1, Low: 1, Medium: 1, Urgent: 3 },
      activeOwned: 2,
      activeUnassigned: 3,
      byStatus: {
        Cancelled: 0,
        Closed: 1,
        "In Progress": 1,
        New: 2,
        Open: 1,
        Reopened: 1,
        Resolved: 1,
        "Waiting for Requester": 1,
      },
      myActions: 3,
    });

    const previews = asJsonObject(dashboard.previews);
    assert.deepEqual(
      fieldValues(previews.recentlyUpdatedTickets, "ticketNumber"),
      [
        "TKT-20261013-DASH001",
        "TKT-20261013-DASH002",
        "TKT-20261013-DASH003",
        "TKT-20261013-DASH004",
        "TKT-20261013-DASH005",
      ]
    );
    assert.deepEqual(
      fieldValues(previews.urgentActiveTickets, "ticketNumber"),
      ["TKT-20261013-DASH001", "TKT-20261013-DASH003", "TKT-20261013-DASH008"]
    );
    assert.deepEqual(fieldValues(previews.myActions, "description"), [
      "Action one",
      "Action two",
      "Action three",
    ]);

    const otherResponse = await request(activeFixture.app)
      .get("/api/staff/dashboard")
      .set(authHeaders(otherStaff))
      .expect(200);
    const otherCounts = asJsonObject(asJsonObject(otherResponse.body).counts);
    assert.equal(otherCounts.activeOwned, 1);
    assert.equal(otherCounts.activeUnassigned, 3);
    assert.equal(otherCounts.myActions, 1);
  });

  it("caps the urgent preview at five active Urgent Tickets", async () => {
    const now = Date.now();
    await createTicket({
      currentStatus: "Resolved",
      itPriority: "Urgent",
      ownerId: staffId,
      resolvedAt: new Date(now - 30 * 60 * 1000),
      ticketNumber: "TKT-URG-RESOLVED",
      updatedAt: new Date(now - 30 * 60 * 1000),
    });
    await Promise.all(
      [1, 2, 3, 4, 5, 6].map(
        async (index) =>
          await createTicket({
            currentStatus: "Open",
            itPriority: "Urgent",
            ownerId: null,
            ticketNumber: `TKT-URG-ACTIVE-${index}`,
            updatedAt: new Date(now - index * hourMs),
          })
      )
    );

    const response = await request(getFixture().app)
      .get("/api/staff/dashboard")
      .set(authHeaders(staff))
      .expect(200);
    const dashboard = asJsonObject(response.body);

    assert.equal(
      asJsonObject(asJsonObject(dashboard.counts).activeByPriority).Urgent,
      6
    );
    assert.deepEqual(
      fieldValues(
        asJsonObject(dashboard.previews).urgentActiveTickets,
        "ticketNumber"
      ),
      [
        "TKT-URG-ACTIVE-1",
        "TKT-URG-ACTIVE-2",
        "TKT-URG-ACTIVE-3",
        "TKT-URG-ACTIVE-4",
        "TKT-URG-ACTIVE-5",
      ]
    );
  });

  it("caps the My Actions preview at five pending Actions", async () => {
    const now = Date.now();
    const ticket = await createTicket({
      currentStatus: "Open",
      itPriority: "Medium",
      ownerId: staffId,
      ticketNumber: "TKT-MYACT-CAP",
      updatedAt: new Date(now - dayMs),
    });
    await Promise.all(
      [1, 2, 3, 4, 5, 6].map(
        async (index) =>
          await createAction({
            assigneeId: staffId,
            createdById: staffId,
            description: `Pending action ${index}`,
            status: index % 2 === 0 ? "InProgress" : "Planned",
            ticketId: ticket.id,
            updatedAt: new Date(now - index * hourMs),
          })
      )
    );

    const response = await request(getFixture().app)
      .get("/api/staff/dashboard")
      .set(authHeaders(staff))
      .expect(200);
    const dashboard = asJsonObject(response.body);

    assert.equal(asJsonObject(dashboard.counts).myActions, 6);
    assert.deepEqual(
      fieldValues(asJsonObject(dashboard.previews).myActions, "description"),
      [
        "Pending action 1",
        "Pending action 2",
        "Pending action 3",
        "Pending action 4",
        "Pending action 5",
      ]
    );
  });

  it("matches every card count and preview to its drill-down list for each staff account", async () => {
    const { app, prisma } = getFixture();
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const statuses: readonly TicketStatus[] = [
      "New",
      "Open",
      "InProgress",
      "WaitingForRequester",
      "Reopened",
      "Resolved",
      "Closed",
      "Cancelled",
    ];
    const priorities: readonly TicketPriority[] = [
      "Low",
      "Medium",
      "High",
      "Urgent",
    ];
    const owners = [null, staffId, otherStaffId, adminUser.id];
    const actionStatuses: readonly ActionStatus[] = [
      "Planned",
      "InProgress",
      "Completed",
      "Cancelled",
    ];
    const assignees = [staffId, otherStaffId, adminUser.id];
    const now = Date.now();
    const combinations = statuses.flatMap((currentStatus) =>
      priorities.flatMap((itPriority) =>
        owners.map((ownerId) => ({ currentStatus, itPriority, ownerId }))
      )
    );

    // 128 Tickets at distinct 2-hour steps, so some fall outside the 7-day window.
    const tickets = await Promise.all(
      combinations.map(
        async (combination, index) =>
          await createTicket({
            ...combination,
            ticketNumber: `TKT-PARITY-${String(index).padStart(3, "0")}`,
            updatedAt: new Date(now - (index + 1) * 2 * hourMs),
          })
      )
    );
    // Every Ticket gets one Action per assignee, rotating through all four states.
    await Promise.all(
      tickets.flatMap((ticket, index) =>
        assignees.map(
          async (assigneeId, assigneeIndex) =>
            await createAction({
              assigneeId,
              createdById: staffId,
              description: `Parity action ${index}-${assigneeIndex}`,
              status:
                actionStatuses[
                  (index + assigneeIndex) % actionStatuses.length
                ] ?? "Planned",
              ticketId: ticket.id,
              updatedAt: new Date(
                now - (index * 3 + assigneeIndex + 1) * 60_000
              ),
            })
        )
      )
    );

    const getJson = async (
      session: AuthenticatedFixtureSession,
      path: string,
      query: Record<string, string> = {}
    ): Promise<JsonObject> => {
      const response = await request(app)
        .get(path)
        .query(query)
        .set(authHeaders(session))
        .expect(200);
      return asJsonObject(response.body);
    };
    const ticketTotal = async (
      session: AuthenticatedFixtureSession,
      query: Record<string, string>
    ) => {
      const page = await getJson(session, "/api/staff/tickets", query);
      return page.totalItems;
    };
    const firstTicketNumbers = async (
      session: AuthenticatedFixtureSession,
      query: Record<string, string>
    ) => {
      const page = await getJson(session, "/api/staff/tickets", {
        ...query,
        sortBy: "updatedAt",
        sortDirection: "desc",
      });
      return fieldValues(page.items, "ticketNumber").slice(0, 5);
    };

    const checkAccount = async (session: AuthenticatedFixtureSession) => {
      const dashboard = await getJson(session, "/api/staff/dashboard");
      const counts = asJsonObject(dashboard.counts);
      const previews = asJsonObject(dashboard.previews);
      const window = asJsonObject(dashboard.window);
      const byStatus = asJsonObject(counts.byStatus);
      const activeByPriority = asJsonObject(counts.activeByPriority);

      const [
        unassigned,
        owned,
        statusTotals,
        priorityTotals,
        urgentTotal,
        urgentFirst,
        recentFirst,
        actionsPage,
      ] = await Promise.all([
        ticketTotal(session, { owner: "unassigned", scope: "active" }),
        ticketTotal(session, { owner: "me", scope: "active" }),
        Promise.all(
          Object.keys(byStatus).map(
            async (currentStatus) =>
              [
                currentStatus,
                await ticketTotal(session, { currentStatus }),
              ] as const
          )
        ),
        Promise.all(
          Object.keys(activeByPriority).map(
            async (itPriority) =>
              [
                itPriority,
                await ticketTotal(session, { itPriority, scope: "active" }),
              ] as const
          )
        ),
        ticketTotal(session, { scope: "urgent-active" }),
        firstTicketNumbers(session, { scope: "urgent-active" }),
        firstTicketNumbers(session, {
          from: getString(window, "from"),
          scope: "recently-updated",
          through: getString(window, "through"),
        }),
        getJson(session, "/api/staff/actions", { pageSize: "50" }),
      ]);

      assert.equal(unassigned, counts.activeUnassigned);
      assert.equal(owned, counts.activeOwned);
      assert.deepEqual(Object.fromEntries(statusTotals), byStatus);
      assert.deepEqual(Object.fromEntries(priorityTotals), activeByPriority);
      assert.equal(urgentTotal, activeByPriority.Urgent);
      assert.deepEqual(
        urgentFirst,
        fieldValues(previews.urgentActiveTickets, "ticketNumber")
      );
      assert.deepEqual(
        recentFirst,
        fieldValues(previews.recentlyUpdatedTickets, "ticketNumber")
      );
      assert.equal(actionsPage.totalItems, counts.myActions);
      assert.deepEqual(
        fieldValues(actionsPage.items, "description").slice(0, 5),
        fieldValues(previews.myActions, "description")
      );
      return counts;
    };

    const accountCounts = await Promise.all(
      [staff, otherStaff, admin].map(checkAccount)
    );
    // The fixture must exercise non-zero, per-account values.
    assert.deepEqual(
      accountCounts.map((counts) => [counts.activeOwned, counts.myActions]),
      [
        [20, 40],
        [20, 40],
        [20, 40],
      ]
    );
  });

  it("serves the dashboard and first list pages within a bounded time and payload", async () => {
    const { app, prisma } = getFixture();
    const statuses: readonly TicketStatus[] = [
      "New",
      "Open",
      "InProgress",
      "WaitingForRequester",
      "Resolved",
      "Closed",
    ];
    const priorities: readonly TicketPriority[] = [
      "Low",
      "Medium",
      "High",
      "Urgent",
    ];
    const now = Date.now();
    // 600 Tickets: a representative staff workload with every card non-zero.
    await prisma.ticket.createMany({
      data: Array.from({ length: 600 }, (_, index) => {
        const updatedAt = new Date(now - (index + 1) * 30 * 60_000);
        return {
          categoryId,
          currentStatus: statuses[index % statuses.length] ?? "New",
          description:
            "A Staff dashboard fixture Ticket with enough detail to read.",
          itPriority: priorities[index % priorities.length] ?? "Low",
          ownerId: [null, staffId, otherStaffId][index % 3] ?? null,
          relatedSystemId,
          requestedPriority: "Medium" as const,
          requesterId,
          statusChangedAt: updatedAt,
          summary: `Staff dashboard perf ${index}`,
          ticketDate: new Date(updatedAt.getTime() - dayMs),
          ticketNumber: `TKT-PERF-${String(index).padStart(4, "0")}`,
          updatedAt,
        };
      }),
    });
    const tickets = await prisma.ticket.findMany({
      orderBy: { ticketNumber: "asc" },
      select: { id: true },
      where: { ticketNumber: { startsWith: "TKT-PERF-" } },
    });
    // Two Actions per Ticket for IT Staff A: 1,200 Actions in all states.
    await prisma.actionTaken.createMany({
      data: tickets.flatMap((ticket, index) =>
        [0, 1].map((offset) => ({
          assigneeId: staffId,
          createdByUserId: staffId,
          description: `Perf action ${index}-${offset}`,
          payloadHash: "a".repeat(64),
          requestId: randomUUID(),
          status:
            (["Planned", "InProgress", "Completed", "Cancelled"] as const)[
              (index + offset) % 4
            ] ?? "Planned",
          ticketId: ticket.id,
          updatedAt: new Date(now - (index * 2 + offset + 1) * 60_000),
        }))
      ),
    });

    const measure = async (path: string, query: Record<string, string>) => {
      const startedAt = performance.now();
      const response = await request(app)
        .get(path)
        .query(query)
        .set(authHeaders(staff))
        .expect(200);
      const durationMs = performance.now() - startedAt;
      const bytes = Buffer.byteLength(response.text);
      // Smoke budget for a local database: one second and 16 KiB per response.
      assert.ok(durationMs < 1000, `${path} took ${durationMs} ms`);
      assert.ok(bytes < 16_384, `${path} returned ${bytes} bytes`);
      return asJsonObject(response.body);
    };

    const dashboard = await measure("/api/staff/dashboard", {});
    const previews = asJsonObject(dashboard.previews);
    for (const preview of [
      previews.urgentActiveTickets,
      previews.recentlyUpdatedTickets,
      previews.myActions,
    ]) {
      assert.equal(asJsonArray(preview).length, 5);
    }
    const counts = asJsonObject(dashboard.counts);
    assert.equal(counts.activeUnassigned, 200);
    assert.equal(counts.myActions, 400);

    const queue = await measure("/api/staff/tickets", {
      owner: "unassigned",
      scope: "active",
    });
    const actions = await measure("/api/staff/actions", {});
    assert.equal(queue.totalItems, counts.activeUnassigned);
    assert.equal(actions.totalItems, counts.myActions);
    assert.ok(asJsonArray(queue.items).length <= 20);
    assert.ok(asJsonArray(actions.items).length <= 20);
  });
});
