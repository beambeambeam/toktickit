import assert from "node:assert/strict";

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

const requesterEmail = "scope-requester@example.test";
const staffEmail = "scope-staff@example.test";
const secondStaffEmail = "scope-second-staff@example.test";
const adminEmail = "scope-admin@example.test";

const windowFrom = "2026-10-06T04:00:00.000Z";
const windowThrough = "2026-10-13T04:00:00.000Z";

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

const ticketNumbersOf = (body: unknown): string[] =>
  asJsonArray(asJsonObject(body).items).map((item) => {
    if (typeof item.ticketNumber !== "string") {
      throw new TypeError("Expected a ticketNumber string.");
    }
    return item.ticketNumber;
  });

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

const errorCode = (response: { body: unknown }): string => {
  const error = asJsonObject(asJsonObject(response.body).error);
  if (typeof error.code !== "string") {
    throw new TypeError("Expected an API error code.");
  }
  return error.code;
};

describe("Lab 4 staff Ticket Queue scopes", () => {
  let fixture: UsersAdminFixture | undefined;
  let requesterId: number;
  let staff: AuthenticatedFixtureSession;
  let staffId: number;
  let secondStaffId: number;
  let requesterSession: AuthenticatedFixtureSession;
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
    itPriority?: TicketPriority;
    ownerId: number | null;
    ticketNumber: string;
    updatedAt: string;
  }) =>
    await getFixture().prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: input.currentStatus,
        description: "A scope fixture Ticket with enough detail to read.",
        itPriority: input.itPriority ?? "Medium",
        ownerId: input.ownerId,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        statusChangedAt: new Date(input.updatedAt),
        summary: `Scope ${input.ticketNumber}`,
        ticketDate: new Date("2026-10-01T04:00:00.000Z"),
        ticketNumber: input.ticketNumber,
        updatedAt: new Date(input.updatedAt),
      },
    });

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    await activeFixture.reset();
    const requesterUser = await activeFixture.createUser({
      displayName: "Scope Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Scope IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const secondStaffUser = await activeFixture.createUser({
      displayName: "Scope Second IT Staff",
      email: secondStaffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Scope Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Scope Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Scope System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    secondStaffId = secondStaffUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requesterSession = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("active scope returns only New, Open, In Progress, Waiting for Requester, and Reopened Tickets", async () => {
    const { app } = getFixture();
    await createTicket({
      currentStatus: "New",
      ownerId: null,
      ticketNumber: "TKT-SCOPE-NEW",
      updatedAt: "2026-10-10T10:00:00.000Z",
    });
    await createTicket({
      currentStatus: "Open",
      ownerId: staffId,
      ticketNumber: "TKT-SCOPE-OPEN",
      updatedAt: "2026-10-10T10:01:00.000Z",
    });
    await createTicket({
      currentStatus: "InProgress",
      ownerId: staffId,
      ticketNumber: "TKT-SCOPE-INPROGRESS",
      updatedAt: "2026-10-10T10:02:00.000Z",
    });
    await createTicket({
      currentStatus: "WaitingForRequester",
      ownerId: staffId,
      ticketNumber: "TKT-SCOPE-WAITING",
      updatedAt: "2026-10-10T10:03:00.000Z",
    });
    await createTicket({
      currentStatus: "Reopened",
      ownerId: staffId,
      ticketNumber: "TKT-SCOPE-REOPENED",
      updatedAt: "2026-10-10T10:04:00.000Z",
    });
    await createTicket({
      currentStatus: "Resolved",
      ownerId: staffId,
      ticketNumber: "TKT-SCOPE-RESOLVED",
      updatedAt: "2026-10-10T10:05:00.000Z",
    });
    await createTicket({
      currentStatus: "Closed",
      ownerId: staffId,
      ticketNumber: "TKT-SCOPE-CLOSED",
      updatedAt: "2026-10-10T10:06:00.000Z",
    });
    await createTicket({
      currentStatus: "Cancelled",
      ownerId: null,
      ticketNumber: "TKT-SCOPE-CANCELLED",
      updatedAt: "2026-10-10T10:07:00.000Z",
    });

    const response = await request(app)
      .get("/api/staff/tickets?scope=active&pageSize=50")
      .set(authHeaders(staff))
      .expect(200);
    const body = asJsonObject(response.body);

    assert.equal(body.totalItems, 5);
    assert.deepEqual(
      new Set(ticketNumbersOf(body)),
      new Set([
        "TKT-SCOPE-INPROGRESS",
        "TKT-SCOPE-NEW",
        "TKT-SCOPE-OPEN",
        "TKT-SCOPE-REOPENED",
        "TKT-SCOPE-WAITING",
      ])
    );
  });

  it("recently-updated includes rows exactly at both bounds and orders updatedAt descending", async () => {
    const { app } = getFixture();
    await createTicket({
      currentStatus: "New",
      ownerId: null,
      ticketNumber: "TKT-BND-BEFORE-FROM",
      updatedAt: "2026-10-06T03:59:59.999Z",
    });
    await createTicket({
      currentStatus: "New",
      ownerId: null,
      ticketNumber: "TKT-BND-AT-FROM",
      updatedAt: windowFrom,
    });
    await createTicket({
      currentStatus: "Open",
      ownerId: staffId,
      ticketNumber: "TKT-BND-INSIDE",
      updatedAt: "2026-10-10T12:00:00.000Z",
    });
    await createTicket({
      currentStatus: "Resolved",
      ownerId: staffId,
      ticketNumber: "TKT-BND-AT-THROUGH",
      updatedAt: windowThrough,
    });
    await createTicket({
      currentStatus: "New",
      ownerId: null,
      ticketNumber: "TKT-BND-AFTER-THROUGH",
      updatedAt: "2026-10-13T04:00:00.001Z",
    });

    const response = await request(app)
      .get(
        `/api/staff/tickets?scope=recently-updated&from=${windowFrom}&through=${windowThrough}`
      )
      .set(authHeaders(staff))
      .expect(200);

    assert.deepEqual(ticketNumbersOf(response.body), [
      "TKT-BND-AT-THROUGH",
      "TKT-BND-INSIDE",
      "TKT-BND-AT-FROM",
    ]);
  });

  it("urgent-active returns only active Urgent Tickets ordered by updatedAt descending", async () => {
    const { app } = getFixture();
    await createTicket({
      currentStatus: "New",
      itPriority: "Urgent",
      ownerId: null,
      ticketNumber: "TKT-URG-OLDER",
      updatedAt: "2026-10-09T08:00:00.000Z",
    });
    await createTicket({
      currentStatus: "InProgress",
      itPriority: "Urgent",
      ownerId: staffId,
      ticketNumber: "TKT-URG-NEWER",
      updatedAt: "2026-10-11T08:00:00.000Z",
    });
    await createTicket({
      currentStatus: "Resolved",
      itPriority: "Urgent",
      ownerId: staffId,
      ticketNumber: "TKT-URG-RESOLVED",
      updatedAt: "2026-10-12T08:00:00.000Z",
    });
    await createTicket({
      currentStatus: "New",
      itPriority: "High",
      ownerId: null,
      ticketNumber: "TKT-URG-HIGH",
      updatedAt: "2026-10-12T09:00:00.000Z",
    });
    await createTicket({
      currentStatus: "Cancelled",
      itPriority: "Urgent",
      ownerId: null,
      ticketNumber: "TKT-URG-CANCELLED",
      updatedAt: "2026-10-12T10:00:00.000Z",
    });

    const response = await request(app)
      .get("/api/staff/tickets?scope=urgent-active")
      .set(authHeaders(staff))
      .expect(200);

    assert.equal(asJsonObject(response.body).totalItems, 2);
    assert.deepEqual(ticketNumbersOf(response.body), [
      "TKT-URG-NEWER",
      "TKT-URG-OLDER",
    ]);
  });

  it("owner=me, owner=unassigned, and a numeric owner filter Tickets by Ticket Owner", async () => {
    const { app } = getFixture();
    await createTicket({
      currentStatus: "Open",
      ownerId: staffId,
      ticketNumber: "TKT-OWN-STAFF-ONE",
      updatedAt: "2026-10-10T10:00:00.000Z",
    });
    await createTicket({
      currentStatus: "InProgress",
      ownerId: staffId,
      ticketNumber: "TKT-OWN-STAFF-TWO",
      updatedAt: "2026-10-10T10:01:00.000Z",
    });
    await createTicket({
      currentStatus: "Open",
      ownerId: secondStaffId,
      ticketNumber: "TKT-OWN-SECOND",
      updatedAt: "2026-10-10T10:02:00.000Z",
    });
    await createTicket({
      currentStatus: "New",
      ownerId: null,
      ticketNumber: "TKT-OWN-UNASSIGNED",
      updatedAt: "2026-10-10T10:03:00.000Z",
    });

    const mine = await request(app)
      .get("/api/staff/tickets?owner=me&pageSize=50")
      .set(authHeaders(staff))
      .expect(200);
    assert.deepEqual(
      new Set(ticketNumbersOf(mine.body)),
      new Set(["TKT-OWN-STAFF-ONE", "TKT-OWN-STAFF-TWO"])
    );

    const unassigned = await request(app)
      .get("/api/staff/tickets?owner=unassigned&pageSize=50")
      .set(authHeaders(staff))
      .expect(200);
    assert.deepEqual(ticketNumbersOf(unassigned.body), ["TKT-OWN-UNASSIGNED"]);

    const numeric = await request(app)
      .get(`/api/staff/tickets?owner=${secondStaffId}&pageSize=50`)
      .set(authHeaders(staff))
      .expect(200);
    assert.deepEqual(ticketNumbersOf(numeric.body), ["TKT-OWN-SECOND"]);
  });

  it("rejects invalid scope, time bound, owner, and duplicate combinations with 400 VALIDATION_ERROR", async () => {
    const { app } = getFixture();
    const invalidQueries = [
      `scope=active&from=${windowFrom}&through=${windowThrough}`,
      `scope=urgent-active&from=${windowFrom}&through=${windowThrough}`,
      "scope=recently-updated",
      `scope=recently-updated&from=${windowFrom}`,
      `scope=recently-updated&through=${windowThrough}`,
      `scope=recently-updated&from=${windowThrough}&through=${windowFrom}`,
      "scope=recently-updated&from=2026-10-06T04:00:00&through=2026-10-13T04:00:00.000Z",
      "scope=waiting-for-requester",
      "scope=active&scope=urgent-active",
      "owner=abc",
      "owner=me&owner=unassigned",
    ];

    const results = await Promise.all(
      invalidQueries.map(async (query) => ({
        query,
        response: await request(app)
          .get(`/api/staff/tickets?${query}`)
          .set(authHeaders(staff)),
      }))
    );

    for (const { query, response } of results) {
      assert.equal(response.status, 400, query);
      assert.equal(errorCode(response), "VALIDATION_ERROR", query);
    }
  });

  it("returns zero results for an eligible owner with no Tickets, and 400 for an ineligible owner", async () => {
    const { app } = getFixture();
    await createTicket({
      currentStatus: "Open",
      ownerId: staffId,
      ticketNumber: "TKT-OWN-NONE",
      updatedAt: "2026-10-10T10:00:00.000Z",
    });

    const eligibleEmpty = await request(app)
      .get(`/api/staff/tickets?owner=${secondStaffId}`)
      .set(authHeaders(staff))
      .expect(200);
    assert.equal(asJsonObject(eligibleEmpty.body).totalItems, 0);
    assert.deepEqual(ticketNumbersOf(eligibleEmpty.body), []);

    const ineligible = await request(app)
      .get(`/api/staff/tickets?owner=${requesterId}`)
      .set(authHeaders(staff))
      .expect(400);
    assert.equal(errorCode(ineligible), "OWNER_INELIGIBLE");
  });

  it("rejects Requester access to the staff Ticket queue scopes with 403", async () => {
    const { app } = getFixture();
    const response = await request(app)
      .get("/api/staff/tickets?scope=active")
      .set(authHeaders(requesterSession))
      .expect(403);

    assert.equal(errorCode(response), "FORBIDDEN");
  });
});
