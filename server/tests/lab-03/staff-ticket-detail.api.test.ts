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
type WireStatus =
  | "Cancelled"
  | "Closed"
  | "In Progress"
  | "New"
  | "Open"
  | "Reopened"
  | "Resolved"
  | "Waiting for Requester";
type DatabaseStatus =
  | "Cancelled"
  | "Closed"
  | "InProgress"
  | "New"
  | "Open"
  | "Reopened"
  | "Resolved"
  | "WaitingForRequester";

const databaseStatus: Record<WireStatus, DatabaseStatus> = {
  Cancelled: "Cancelled",
  Closed: "Closed",
  "In Progress": "InProgress",
  New: "New",
  Open: "Open",
  Reopened: "Reopened",
  Resolved: "Resolved",
  "Waiting for Requester": "WaitingForRequester",
};

const requesterEmail = "workflow-requester@example.test";
const otherRequesterEmail = "workflow-other-requester@example.test";
const staffEmail = "workflow-staff@example.test";
const secondStaffEmail = "workflow-second-staff@example.test";
const adminEmail = "workflow-admin@example.test";

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

describe("Lab 3 Ticket workflow and resolution indication", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let otherRequester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketSequence = 0;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }

    return fixture;
  };

  const createTicket = async (input: {
    currentStatus?: WireStatus;
    indicated?: boolean;
    ownerId?: number | null;
  }) => {
    const activeFixture = getFixture();
    const ticketDate = new Date("2026-09-16T10:00:00.000Z");
    ticketSequence += 1;
    const currentStatus = input.currentStatus ?? "New";

    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: databaseStatus[currentStatus],
        description: "A sufficiently long workflow fixture description.",
        itPriority: "Low",
        ownerId: input.ownerId ?? null,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        resolutionIndicatedAt: input.indicated === true ? ticketDate : null,
        resolutionIndicatedByUserId:
          input.indicated === true ? requesterId : null,
        resolvedAt: currentStatus === "Resolved" ? ticketDate : null,
        statusChangedAt: ticketDate,
        summary: "Workflow fixture ticket",
        ticketDate,
        ticketNumber: `TKT-20260916-WF${ticketSequence.toString().padStart(4, "0")}`,
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
      displayName: "Workflow Requester",
      email: requesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Other Workflow Requester",
      email: otherRequesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Workflow Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Second Workflow Staff",
      email: secondStaffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Workflow Administrator",
      email: adminEmail,
      role: "Administrator",
    });

    const category = await activeFixture.prisma.category.create({
      data: { name: "Workflow Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Workflow System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    ticketSequence = 0;
    requester = await activeFixture.authenticate(requesterEmail);
    otherRequester = await activeFixture.authenticate(otherRequesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("applies every allowed workflow transition with timestamps", async () => {
    const activeFixture = getFixture();
    const transitions: {
      from: WireStatus;
      to: WireStatus;
    }[] = [
      { from: "New", to: "Open" },
      { from: "New", to: "Cancelled" },
      { from: "Open", to: "In Progress" },
      { from: "Open", to: "Waiting for Requester" },
      { from: "Open", to: "Cancelled" },
      { from: "In Progress", to: "Waiting for Requester" },
      { from: "In Progress", to: "Resolved" },
      { from: "In Progress", to: "Cancelled" },
      { from: "Waiting for Requester", to: "In Progress" },
      { from: "Waiting for Requester", to: "Resolved" },
      { from: "Waiting for Requester", to: "Cancelled" },
      { from: "Resolved", to: "Closed" },
      { from: "Resolved", to: "Reopened" },
      { from: "Reopened", to: "Open" },
      { from: "Reopened", to: "In Progress" },
      { from: "Reopened", to: "Cancelled" },
    ];

    for (const [index, transition] of transitions.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- Each transition needs its own isolated Ticket.
      const ticket = await createTicket({
        currentStatus: transition.from,
        ownerId:
          transition.to === "In Progress" || transition.to === "Resolved"
            ? staffId
            : null,
      });
      // oxlint-disable-next-line no-await-in-loop -- Keep each matrix assertion tied to its created Ticket.
      const response = await request(activeFixture.app)
        .post(`/api/tickets/${ticket.id}/status`)
        .set(authHeaders(staff))
        .send({
          currentStatus: transition.to,
          ...(transition.to === "Resolved" ||
          transition.to === "Closed" ||
          transition.to === "Cancelled"
            ? { confirmed: true }
            : {}),
          version: 1,
        })
        .expect(200);
      const body = asJsonObject(response.body);

      assert.equal(body.currentStatus, transition.to);
      assert.equal(body.version, 2);
      assert.equal(typeof body.statusChangedAt, "string");

      if (transition.to === "Resolved") {
        assert.equal(body.resolvedAt, body.statusChangedAt);
      }
      if (transition.to === "Closed") {
        assert.equal(body.closedAt, body.statusChangedAt);
      }
      if (transition.to === "Cancelled") {
        assert.equal(body.cancelledAt, body.statusChangedAt);
      }
      if (transition.to === "Reopened") {
        assert.equal(body.reopenedAt, body.statusChangedAt);
        assert.equal(body.resolvedAt, null);
        assert.equal(body.resolutionIndication, null);
      }

      assert.equal(index + 1, ticketSequence);
    }
  });

  it("enforces owner, confirmation, version, and role guards", async () => {
    const activeFixture = getFixture();
    const ownerRequiredTicket = await createTicket({ currentStatus: "Open" });
    const ownerRequired = await request(activeFixture.app)
      .post(`/api/tickets/${ownerRequiredTicket.id}/status`)
      .set(authHeaders(staff))
      .send({ currentStatus: "In Progress", version: 1 })
      .expect(409);
    assert.equal(errorCode(ownerRequired), "OWNER_REQUIRED");

    const confirmationTicket = await createTicket({});
    const missingConfirmation = await request(activeFixture.app)
      .post(`/api/tickets/${confirmationTicket.id}/status`)
      .set(authHeaders(staff))
      .send({ currentStatus: "Cancelled", version: 1 })
      .expect(400);
    assert.equal(errorCode(missingConfirmation), "CONFIRMATION_REQUIRED");

    const staleTicket = await createTicket({ ownerId: staffId });
    const stale = await request(activeFixture.app)
      .post(`/api/tickets/${staleTicket.id}/status`)
      .set(authHeaders(staff))
      .send({ currentStatus: "In Progress", version: 99 })
      .expect(409);
    assert.equal(errorCode(stale), "VERSION_CONFLICT");

    const terminalTicket = await createTicket({ currentStatus: "Closed" });
    const invalidTerminalEdge = await request(activeFixture.app)
      .post(`/api/tickets/${terminalTicket.id}/status`)
      .set(authHeaders(staff))
      .send({ confirmed: true, currentStatus: "Reopened", version: 1 })
      .expect(409);
    assert.equal(errorCode(invalidTerminalEdge), "INVALID_TRANSITION");

    for (const session of [requester, admin]) {
      // oxlint-disable-next-line no-await-in-loop -- Verify each protected role independently.
      const response = await request(activeFixture.app)
        .post(`/api/tickets/${ownerRequiredTicket.id}/status`)
        .set(authHeaders(session))
        .send({ currentStatus: "Open", version: 1 })
        .expect(403);
      assert.equal(errorCode(response), "FORBIDDEN");
    }

    const stored = await activeFixture.prisma.ticket.findUnique({
      select: { currentStatus: true, version: true },
      where: { id: confirmationTicket.id },
    });
    assert.deepEqual(stored, { currentStatus: "New", version: 1 });
  });

  it("records idempotent own indication and clears it on reopen", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({});

    const first = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({})
      .expect(200);
    const firstBody = asJsonObject(first.body);
    const firstIndication = asJsonObject(firstBody.resolutionIndication);
    assert.equal(asJsonObject(firstIndication.author).id, requesterId);

    const storedAfterFirst = await activeFixture.prisma.ticket.findUnique({
      select: {
        currentStatus: true,
        resolutionIndicatedAt: true,
        resolutionIndicatedByUserId: true,
        version: true,
      },
      where: { id: ticket.id },
    });
    assert.equal(storedAfterFirst?.currentStatus, "New");
    assert.equal(storedAfterFirst?.resolutionIndicatedByUserId, requesterId);
    assert.equal(storedAfterFirst?.version, 2);

    const second = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({})
      .expect(200);
    assert.deepEqual(second.body, first.body);

    const storedAfterSecond = await activeFixture.prisma.ticket.findUnique({
      select: { resolutionIndicatedAt: true, version: true },
      where: { id: ticket.id },
    });
    assert.equal(
      storedAfterSecond?.resolutionIndicatedAt?.toISOString(),
      storedAfterFirst?.resolutionIndicatedAt?.toISOString()
    );
    assert.equal(storedAfterSecond?.version, 2);

    const other = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(otherRequester))
      .send({})
      .expect(404);
    assert.equal(errorCode(other), "RESOURCE_NOT_FOUND");

    for (const session of [staff, admin]) {
      // oxlint-disable-next-line no-await-in-loop -- Verify each forbidden role independently.
      const response = await request(activeFixture.app)
        .put(`/api/tickets/${ticket.id}/resolution-indication`)
        .set(authHeaders(session))
        .send({})
        .expect(403);
      assert.equal(errorCode(response), "FORBIDDEN");
    }

    const terminalTicket = await createTicket({ currentStatus: "Closed" });
    const terminal = await request(activeFixture.app)
      .put(`/api/tickets/${terminalTicket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({})
      .expect(409);
    assert.equal(errorCode(terminal), "TICKET_TERMINAL");

    const indicatedResolvedTicket = await createTicket({
      currentStatus: "Resolved",
      indicated: true,
      ownerId: staffId,
    });
    const reopened = await request(activeFixture.app)
      .post(`/api/tickets/${indicatedResolvedTicket.id}/status`)
      .set(authHeaders(staff))
      .send({ currentStatus: "Reopened", version: 1 })
      .expect(200);
    const reopenedBody = asJsonObject(reopened.body);
    assert.equal(reopenedBody.currentStatus, "Reopened");
    assert.equal(reopenedBody.resolutionIndication, null);
    assert.equal(reopenedBody.resolvedAt, null);
    assert.equal(typeof reopenedBody.reopenedAt, "string");
  });

  it("rejects malformed status and indication bodies without writes", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({});

    const invalidStatus = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(staff))
      .send({ currentStatus: "Open", extra: true, version: 1 })
      .expect(400);
    assert.equal(errorCode(invalidStatus), "VALIDATION_ERROR");

    const invalidIndication = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({ extra: true })
      .expect(400);
    assert.equal(errorCode(invalidIndication), "VALIDATION_ERROR");

    const stored = await activeFixture.prisma.ticket.findUnique({
      select: {
        currentStatus: true,
        resolutionIndicatedAt: true,
        version: true,
      },
      where: { id: ticket.id },
    });
    assert.deepEqual(stored, {
      currentStatus: "New",
      resolutionIndicatedAt: null,
      version: 1,
    });
  });
});
