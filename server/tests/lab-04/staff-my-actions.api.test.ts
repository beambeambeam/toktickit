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
type TicketStatus = "Cancelled" | "InProgress" | "New" | "Resolved";
type ActionStatus = "Cancelled" | "Completed" | "InProgress" | "Planned";

const requesterEmail = "my-actions-requester@example.test";
const staffEmail = "my-actions-staff@example.test";
const adminEmail = "my-actions-admin@example.test";
const otherStaffEmail = "my-actions-other-staff@example.test";
const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

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

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

const errorCode = (response: { body: unknown }): string => {
  const error = asJsonObject(asJsonObject(response.body).error);
  return getString(error, "code");
};

describe("Lab 4 My Actions API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
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
    ownerId: number | null;
    ticketNumber: string;
    updatedAt: Date;
  }) =>
    await getFixture().prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: input.currentStatus,
        description: "A My Actions fixture Ticket with enough detail to read.",
        itPriority: "Medium",
        ownerId: input.ownerId,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        statusChangedAt: input.updatedAt,
        summary: `My Actions ${input.ticketNumber}`,
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
        payloadHash: "b".repeat(64),
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
      displayName: "My Actions Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "My Actions IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "My Actions Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const otherStaffUser = await activeFixture.createUser({
      displayName: "My Actions Other IT Staff",
      email: otherStaffEmail,
      role: "ITStaff",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "My Actions Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "My Actions System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    otherStaffId = otherStaffUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("enforces staff role and authentication for My Actions", async () => {
    const { app } = getFixture();

    const unauthenticated = await request(app)
      .get("/api/staff/actions")
      .expect(401);
    assert.equal(errorCode(unauthenticated), "AUTHENTICATION_REQUIRED");

    const requesterResponse = await request(app)
      .get("/api/staff/actions")
      .set(authHeaders(requester))
      .expect(403);
    assert.equal(errorCode(requesterResponse), "FORBIDDEN");

    await request(app)
      .get("/api/staff/actions")
      .set(authHeaders(staff))
      .expect(200);
    await request(app)
      .get("/api/staff/actions")
      .set(authHeaders(admin))
      .expect(200);
  });

  it("rejects requesterId, assigneeId, status, owner, creator, unknown, and invalid paging", async () => {
    const { app } = getFixture();
    const unsupportedQueries = [
      "requesterId=1",
      "assigneeId=1",
      "status=Planned",
      "owner=me",
      "creator=me",
      "unknown=1",
      "pageSize=15",
      "page=0",
    ];

    const responses = await Promise.all(
      unsupportedQueries.map((query) =>
        request(app).get(`/api/staff/actions?${query}`).set(authHeaders(staff))
      )
    );

    for (const response of responses) {
      assert.equal(response.status, 400);
      assert.equal(errorCode(response), "VALIDATION_ERROR");
    }
  });

  it("lists only the account's Planned or In Progress Actions on active Tickets", async () => {
    const activeFixture = getFixture();
    const now = Date.now();
    const at = (offsetMs: number) => new Date(now - offsetMs);

    const activeOne = await createTicket({
      currentStatus: "New",
      ownerId: otherStaffId,
      ticketNumber: "TKT-20261013-MA001",
      updatedAt: at(1 * minuteMs),
    });
    const activeTwo = await createTicket({
      currentStatus: "InProgress",
      ownerId: staffId,
      ticketNumber: "TKT-20261013-MA002",
      updatedAt: at(2 * minuteMs),
    });
    const resolved = await createTicket({
      currentStatus: "Resolved",
      ownerId: staffId,
      ticketNumber: "TKT-20261013-MA003",
      updatedAt: at(3 * minuteMs),
    });
    const cancelled = await createTicket({
      currentStatus: "Cancelled",
      ownerId: null,
      ticketNumber: "TKT-20261013-MA004",
      updatedAt: at(4 * minuteMs),
    });

    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Planned on active",
      status: "Planned",
      ticketId: activeOne.id,
      updatedAt: at(1 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "In Progress on active",
      status: "InProgress",
      ticketId: activeTwo.id,
      updatedAt: at(2 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: otherStaffId,
      description: "Created by other",
      status: "Planned",
      ticketId: activeTwo.id,
      updatedAt: at(3 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Completed excluded",
      status: "Completed",
      ticketId: activeOne.id,
      updatedAt: at(4 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Cancelled excluded",
      status: "Cancelled",
      ticketId: activeOne.id,
      updatedAt: at(5 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "Planned on Resolved excluded",
      status: "Planned",
      ticketId: resolved.id,
      updatedAt: at(6 * hourMs),
    });
    await createAction({
      assigneeId: staffId,
      createdById: staffId,
      description: "In Progress on Cancelled excluded",
      status: "InProgress",
      ticketId: cancelled.id,
      updatedAt: at(7 * hourMs),
    });
    await createAction({
      assigneeId: otherStaffId,
      createdById: staffId,
      description: "Other assignee excluded",
      status: "Planned",
      ticketId: activeOne.id,
      updatedAt: at(8 * hourMs),
    });

    const response = await request(activeFixture.app)
      .get("/api/staff/actions")
      .set(authHeaders(staff))
      .expect(200);
    const body = asJsonObject(response.body);
    const items = asJsonArray(body.items);

    assert.equal(body.page, 1);
    assert.equal(body.pageSize, 20);
    assert.equal(body.totalItems, 3);
    assert.equal(body.totalPages, 1);
    assert.deepEqual(
      items.map((item) => [
        getString(item, "description"),
        getString(item, "status"),
      ]),
      [
        ["Planned on active", "Planned"],
        ["In Progress on active", "In Progress"],
        ["Created by other", "Planned"],
      ]
    );
    assert.deepEqual(
      items.map((item) => asJsonObject(item.ticket).ticketNumber),
      ["TKT-20261013-MA001", "TKT-20261013-MA002", "TKT-20261013-MA002"]
    );

    const dashboard = await request(activeFixture.app)
      .get("/api/staff/dashboard")
      .set(authHeaders(staff))
      .expect(200);
    assert.equal(
      asJsonObject(asJsonObject(dashboard.body).counts).myActions,
      3
    );
  });

  it("paginates My Actions with default 20 and 10 or 50 page sizes", async () => {
    const activeFixture = getFixture();
    const now = Date.now();
    const ticket = await createTicket({
      currentStatus: "New",
      ownerId: null,
      ticketNumber: "TKT-20261013-PAGE",
      updatedAt: new Date(now),
    });

    await Promise.all(
      Array.from(
        { length: 25 },
        async (_value, index) =>
          await createAction({
            assigneeId: staffId,
            createdById: staffId,
            description: `Paged action ${index}`,
            status: "Planned",
            ticketId: ticket.id,
            updatedAt: new Date(now - index * minuteMs),
          })
      )
    );

    const firstPage = await request(activeFixture.app)
      .get("/api/staff/actions")
      .set(authHeaders(staff))
      .expect(200);
    const firstBody = asJsonObject(firstPage.body);
    assert.equal(firstBody.pageSize, 20);
    assert.equal(firstBody.totalItems, 25);
    assert.equal(firstBody.totalPages, 2);
    assert.equal(asJsonArray(firstBody.items).length, 20);

    const secondPage = await request(activeFixture.app)
      .get("/api/staff/actions?page=2")
      .set(authHeaders(staff))
      .expect(200);
    const secondItems = asJsonArray(asJsonObject(secondPage.body).items);
    assert.equal(secondItems.length, 5);
    assert.equal(
      getString(secondItems.at(-1) ?? {}, "description"),
      "Paged action 24"
    );

    const beyond = await request(activeFixture.app)
      .get("/api/staff/actions?page=3")
      .set(authHeaders(staff))
      .expect(200);
    assert.equal(asJsonArray(asJsonObject(beyond.body).items).length, 0);

    for (const [pageSize, totalPages, firstLength] of [
      [10, 3, 10],
      [50, 1, 25],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Each page size is an independent response.
      const response = await request(activeFixture.app)
        .get(`/api/staff/actions?pageSize=${pageSize}`)
        .set(authHeaders(staff))
        .expect(200);
      const body = asJsonObject(response.body);
      assert.equal(body.pageSize, pageSize);
      assert.equal(body.totalPages, totalPages);
      assert.equal(asJsonArray(body.items).length, firstLength);
    }
  });
});
