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
      [1, 2, 3, 4, 5, 6].map( async (index) =>
        createTicket({
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
});
