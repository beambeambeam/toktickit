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

const requesterEmail = "ownership-requester@example.test";
const staffEmail = "ownership-staff@example.test";
const secondStaffEmail = "ownership-second-staff@example.test";
const adminEmail = "ownership-admin@example.test";

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object.");
  }

  return value;
};

const errorCode = (response: { body: unknown }): string => {
  const error = asJsonObject(asJsonObject(response.body).error);
  if (typeof error.code !== "string") {
    throw new TypeError("Expected an API error code.");
  }

  return error.code;
};

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

describe("Lab 3 Ticket ownership and IT Priority operations", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let secondStaff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let secondStaffId: number;
  let categoryId: number;
  let relatedSystemId: number;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }

    return fixture;
  };

  const createTicket = async (input: {
    currentStatus?:
      | "New"
      | "Open"
      | "InProgress"
      | "WaitingForRequester"
      | "Resolved"
      | "Closed"
      | "Reopened"
      | "Cancelled";
    itPriority?: "Low" | "Medium" | "High" | "Urgent";
    ownerId?: number | null;
    requestedPriority?: "Low" | "Medium" | "High" | "Urgent";
    ticketNumber: string;
  }) => {
    const activeFixture = getFixture();
    const ticketDate = new Date("2026-09-16T10:00:00.000Z");

    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: input.currentStatus ?? "New",
        description: "A sufficiently long ownership fixture description.",
        itPriority: input.itPriority ?? "Low",
        ownerId: input.ownerId ?? null,
        relatedSystemId,
        requestedPriority: input.requestedPriority ?? "Medium",
        requesterId,
        statusChangedAt: ticketDate,
        summary: "Ownership fixture ticket",
        ticketDate,
        ticketNumber: input.ticketNumber,
        updatedAt: ticketDate,
      },
    });
  };

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    await activeFixture.reset();
    const requesterUser = await activeFixture.createUser({
      displayName: "Ownership Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Ownership Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const secondStaffUser = await activeFixture.createUser({
      displayName: "Second Ownership Staff",
      email: secondStaffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Ownership Administrator",
      email: adminEmail,
      role: "Administrator",
    });

    const category = await activeFixture.prisma.category.create({
      data: { name: "Ownership Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Ownership System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    secondStaffId = secondStaffUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    secondStaff = await activeFixture.authenticate(secondStaffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("claims, reassigns, unassigns, and independently changes IT Priority", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      requestedPriority: "Medium",
      ticketNumber: "TKT-20260916-OWN001",
    });

    const claimed = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/claim`)
      .set(authHeaders(staff))
      .send({ version: 1 })
      .expect(200);
    const claimedBody = asJsonObject(claimed.body);
    assert.equal(claimedBody.requestedPriority, "Medium");
    assert.equal(claimedBody.itPriority, "Low");
    assert.equal(claimedBody.version, 2);
    assert.equal(asJsonObject(claimedBody.owner).id, staffId);

    const prioritized = await request(activeFixture.app)
      .patch(`/api/tickets/${ticket.id}/it-priority`)
      .set(authHeaders(staff))
      .send({ itPriority: "Urgent", version: 2 })
      .expect(200);
    const prioritizedBody = asJsonObject(prioritized.body);
    assert.equal(prioritizedBody.requestedPriority, "Medium");
    assert.equal(prioritizedBody.itPriority, "Urgent");
    assert.equal(prioritizedBody.version, 3);

    const reassigned = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/owner`)
      .set(authHeaders(staff))
      .send({ ownerId: secondStaffId, version: 3 })
      .expect(200);
    assert.equal(asJsonObject(reassigned.body).version, 4);
    assert.equal(
      asJsonObject(asJsonObject(reassigned.body).owner).id,
      secondStaffId
    );

    const unassigned = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/owner`)
      .set(authHeaders(staff))
      .send({ ownerId: null, version: 4 })
      .expect(200);
    assert.equal(asJsonObject(unassigned.body).owner, null);
    assert.equal(asJsonObject(unassigned.body).version, 5);

    const stored = await activeFixture.prisma.ticket.findUnique({
      select: {
        currentStatus: true,
        itPriority: true,
        requestedPriority: true,
      },
      where: { id: ticket.id },
    });
    assert.deepEqual(stored, {
      currentStatus: "New",
      itPriority: "Urgent",
      requestedPriority: "Medium",
    });
  });

  it("rejects unauthorized, stale, invalid-owner, and terminal mutations", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      ticketNumber: "TKT-20260916-OWN002",
    });

    const requesterResponse = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/claim`)
      .set(authHeaders(requester))
      .send({ version: 1 })
      .expect(403);
    assert.equal(errorCode(requesterResponse), "FORBIDDEN");

    const adminResponse = await request(activeFixture.app)
      .patch(`/api/tickets/${ticket.id}/it-priority`)
      .set(authHeaders(admin))
      .send({ itPriority: "High", version: 1 })
      .expect(403);
    assert.equal(errorCode(adminResponse), "FORBIDDEN");

    const invalidOwner = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/owner`)
      .set(authHeaders(staff))
      .send({ ownerId: 999_999, version: 1 })
      .expect(409);
    assert.equal(errorCode(invalidOwner), "OWNER_INELIGIBLE");

    const stale = await request(activeFixture.app)
      .patch(`/api/tickets/${ticket.id}/it-priority`)
      .set(authHeaders(staff))
      .send({ itPriority: "High", version: 99 })
      .expect(409);
    assert.equal(errorCode(stale), "VERSION_CONFLICT");

    await activeFixture.prisma.ticket.update({
      data: { currentStatus: "Closed" },
      where: { id: ticket.id },
    });
    const terminal = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/owner`)
      .set(authHeaders(staff))
      .send({ ownerId: staffId, version: 1 })
      .expect(409);
    assert.equal(errorCode(terminal), "TICKET_TERMINAL");
  });

  it("rechecks the acting Staff member inside owner mutations", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      ticketNumber: "TKT-20260916-OWN005",
    });
    const { updateTicketItPriority, updateTicketOwner } =
      await import("../../src/repositories/tickets.js");

    await activeFixture.prisma.user.update({
      data: { isActive: false },
      where: { id: staffId },
    });

    assert.deepEqual(
      await updateTicketOwner(staffId, ticket.id, secondStaffId, 1),
      { kind: "actor-ineligible" }
    );
    assert.deepEqual(
      await updateTicketItPriority(staffId, ticket.id, "Urgent", 1),
      { kind: "actor-ineligible" }
    );

    const stored = await activeFixture.prisma.ticket.findUnique({
      select: { itPriority: true, ownerId: true, version: true },
      where: { id: ticket.id },
    });
    assert.deepEqual(stored, { itPriority: "Low", ownerId: null, version: 1 });
  });

  it("allows one winner when two Staff members claim the same Ticket", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      ticketNumber: "TKT-20260916-OWN003",
    });

    const responses = await Promise.all(
      [staff, secondStaff].map(
        async (session) =>
          await request(activeFixture.app)
            .post(`/api/tickets/${ticket.id}/claim`)
            .set(authHeaders(session))
            .send({ version: 1 })
      )
    );

    assert.equal(
      responses.filter((response) => response.status === 200).length,
      1
    );
    assert.equal(
      responses.filter((response) => response.status === 409).length,
      1
    );
    const conflict = responses.find((response) => response.status === 409);
    assert.ok(conflict !== undefined);
    assert.ok(
      ["ASSIGNMENT_CONFLICT", "VERSION_CONFLICT"].includes(errorCode(conflict))
    );

    const stored = await activeFixture.prisma.ticket.findUnique({
      select: { ownerId: true, version: true },
      where: { id: ticket.id },
    });
    assert.equal(stored?.version, 2);
    assert.ok(stored?.ownerId === staffId || stored?.ownerId === secondStaffId);
  });

  it("rejects malformed mutation bodies without changing the Ticket", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      ticketNumber: "TKT-20260916-OWN004",
    });

    const invalid = await request(activeFixture.app)
      .patch(`/api/tickets/${ticket.id}/it-priority`)
      .set(authHeaders(staff))
      .send({ extra: true, itPriority: "Urgent", version: 1 })
      .expect(400);
    assert.equal(errorCode(invalid), "VALIDATION_ERROR");

    const stored = await activeFixture.prisma.ticket.findUnique({
      select: { itPriority: true, ownerId: true, version: true },
      where: { id: ticket.id },
    });
    assert.deepEqual(stored, { itPriority: "Low", ownerId: null, version: 1 });
  });
});
