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

const requesterEmail = "workflow-requester@example.test";
const staffEmail = "workflow-staff@example.test";
const ownerEmail = "workflow-owner@example.test";

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object.");
  }

  return value;
};

const asJsonObjectArray = (value: unknown): JsonObject[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected a JSON array.");
  }

  return value.map((item: unknown) => asJsonObject(item));
};

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

const readError = (response: { body: unknown }): JsonObject =>
  asJsonObject(asJsonObject(response.body).error);

describe("Lab 4 Ticket lifecycle gate API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let ownerId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketSequence = 0;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }

    return fixture;
  };

  const createTicket = async ({
    currentStatus,
    ownerIdValue = null,
  }: {
    currentStatus: "In Progress" | "Waiting for Requester";
    ownerIdValue?: number | null;
  }) => {
    const activeFixture = getFixture();
    const ticketDate = new Date("2026-09-30T04:00:00.000Z");
    ticketSequence += 1;

    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus:
          currentStatus === "In Progress"
            ? "InProgress"
            : "WaitingForRequester",
        description: "A lifecycle gate fixture Ticket with enough detail.",
        itPriority: "Medium",
        ownerId: ownerIdValue,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        statusChangedAt: ticketDate,
        summary: "Lifecycle gate fixture Ticket",
        ticketDate,
        ticketNumber: `TKT-20260930-WFL${ticketSequence.toString().padStart(3, "0")}`,
        updatedAt: ticketDate,
      },
    });
  };

  const createActionTaken = async ({
    status,
    ticketId,
  }: {
    status: "Planned" | "InProgress" | "Completed" | "Cancelled";
    ticketId: number;
  }) =>
    await getFixture().prisma.actionTaken.create({
      data: {
        assigneeId: ownerId,
        createdByUserId: staffId,
        description: "Lifecycle gate fixture action.",
        payloadHash: "0".repeat(64),
        requestId: randomUUID(),
        status,
        ticketId,
      },
    });

  const postStatus = (
    ticketId: number,
    body: Record<string, unknown>,
    session: AuthenticatedFixtureSession
  ) =>
    request(getFixture().app)
      .post(`/api/tickets/${ticketId}/status`)
      .set(authHeaders(session))
      .send(body);

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    await activeFixture.reset();
    ticketSequence = 0;
    const requesterUser = await activeFixture.createUser({
      displayName: "Workflow Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Workflow Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const ownerUser = await activeFixture.createUser({
      displayName: "Workflow Owner",
      email: ownerEmail,
      role: "ITStaff",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Workflow Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Workflow System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    ownerId = ownerUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("returns one RESOLUTION_GATE_FAILED listing every unmet reason in fixed order", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({ currentStatus: "In Progress" });
    await createActionTaken({ status: "Planned", ticketId: ticket.id });

    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(staff))
      .send({ confirmed: true, currentStatus: "Resolved", version: 1 })
      .expect(409);

    const error = readError(response);
    assert.equal(error.code, "RESOLUTION_GATE_FAILED");
    assert.deepEqual(asJsonObject(error.details).reasons, [
      "OWNER_REQUIRED",
      "PENDING_ACTIONS",
      "NO_COMPLETED_ACTION",
    ]);

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(stored.currentStatus, "InProgress");
    assert.equal(stored.version, 1);
  });

  it("does not count Cancelled actions as completed work", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Cancelled", ticketId: ticket.id });

    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(staff))
      .send({ confirmed: true, currentStatus: "Resolved", version: 1 })
      .expect(409);

    const error = readError(response);
    assert.equal(error.code, "RESOLUTION_GATE_FAILED");
    assert.deepEqual(asJsonObject(error.details).reasons, [
      "NO_COMPLETED_ACTION",
    ]);
  });

  it("resolves an In Progress Ticket with an eligible owner and a Completed action", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Completed", ticketId: ticket.id });

    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(staff))
      .send({ confirmed: true, currentStatus: "Resolved", version: 1 })
      .expect(200);

    assert.equal(asJsonObject(response.body).currentStatus, "Resolved");
  });

  it("reopens a Resolved Ticket, clears resolution fields, and records each status event", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Completed", ticketId: ticket.id });

    await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({})
      .expect(200);
    await postStatus(
      ticket.id,
      { confirmed: true, currentStatus: "Resolved", version: 2 },
      staff
    ).expect(200);
    await postStatus(
      ticket.id,
      { currentStatus: "Reopened", version: 3 },
      staff
    ).expect(200);

    const reopened = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(reopened.currentStatus, "Reopened");
    assert.equal(reopened.resolvedAt, null);
    assert.equal(reopened.resolutionIndicatedAt, null);
    assert.equal(reopened.resolutionIndicatedByUserId, null);
    assert.equal(reopened.version, 4);

    await postStatus(
      ticket.id,
      { currentStatus: "In Progress", version: 4 },
      staff
    ).expect(200);
    await createActionTaken({ status: "Planned", ticketId: ticket.id });
    const gateResponse = await postStatus(
      ticket.id,
      { confirmed: true, currentStatus: "Resolved", version: 5 },
      staff
    ).expect(409);
    assert.deepEqual(asJsonObject(readError(gateResponse).details).reasons, [
      "PENDING_ACTIONS",
    ]);

    const historyResponse = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/status-history`)
      .set(authHeaders(staff))
      .expect(200);
    const history = asJsonObject(historyResponse.body);
    assert.equal(history.totalItems, 3);
    const events = asJsonObjectArray(history.items).map((event) => ({
      confirmed: event.confirmed,
      fromStatus: event.fromStatus,
      ticketVersion: event.ticketVersion,
      toStatus: event.toStatus,
    }));
    assert.deepEqual(events, [
      {
        confirmed: true,
        fromStatus: "In Progress",
        ticketVersion: 3,
        toStatus: "Resolved",
      },
      {
        confirmed: false,
        fromStatus: "Resolved",
        ticketVersion: 4,
        toStatus: "Reopened",
      },
      {
        confirmed: false,
        fromStatus: "Reopened",
        ticketVersion: 5,
        toStatus: "In Progress",
      },
    ]);
  });

  it("blocks Cancelled while a Planned action remains", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Planned", ticketId: ticket.id });

    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(staff))
      .send({ confirmed: true, currentStatus: "Cancelled", version: 1 })
      .expect(409);

    assert.equal(readError(response).code, "TICKET_HAS_PENDING_ACTIONS");

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(stored.currentStatus, "InProgress");
    assert.equal(stored.version, 1);
  });

  it("allows Cancelled once no Planned or In Progress action remains", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Cancelled", ticketId: ticket.id });

    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(staff))
      .send({ confirmed: true, currentStatus: "Cancelled", version: 1 })
      .expect(200);

    assert.equal(asJsonObject(response.body).currentStatus, "Cancelled");
  });

  it("rejects unlisted Ticket status edges without writing", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });

    const response = await postStatus(
      ticket.id,
      { confirmed: true, currentStatus: "Closed", version: 1 },
      staff
    ).expect(409);

    assert.equal(readError(response).code, "INVALID_TRANSITION");

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(stored.currentStatus, "InProgress");
    assert.equal(stored.version, 1);
    assert.equal(
      await activeFixture.prisma.ticketStatusEvent.count({
        where: { ticketId: ticket.id },
      }),
      0
    );
  });

  it("requires confirmed true for Resolved, Closed, and Cancelled", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Completed", ticketId: ticket.id });

    const responses = await Promise.all(
      [
        { currentStatus: "Resolved" },
        { confirmed: false, currentStatus: "Resolved" },
        { currentStatus: "Closed" },
        { confirmed: false, currentStatus: "Closed" },
        { currentStatus: "Cancelled" },
        { confirmed: false, currentStatus: "Cancelled" },
      ].map((body) => postStatus(ticket.id, { ...body, version: 1 }, staff))
    );

    for (const response of responses) {
      assert.equal(response.status, 400, response.text);
      assert.equal(readError(response).code, "CONFIRMATION_REQUIRED");
    }

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(stored.currentStatus, "InProgress");
    assert.equal(stored.version, 1);
  });

  it("requires an active eligible Ticket Owner before In Progress", async () => {
    const activeFixture = getFixture();
    const unowned = await createTicket({
      currentStatus: "Waiting for Requester",
    });
    const owned = await createTicket({
      currentStatus: "Waiting for Requester",
      ownerIdValue: ownerId,
    });

    const unownedResponse = await postStatus(
      unowned.id,
      { currentStatus: "In Progress", version: 1 },
      staff
    ).expect(409);
    assert.equal(readError(unownedResponse).code, "OWNER_REQUIRED");

    await postStatus(
      owned.id,
      { currentStatus: "In Progress", version: 1 },
      staff
    ).expect(200);

    await activeFixture.prisma.user.update({
      data: { isActive: false },
      where: { id: ownerId },
    });
    const inactiveOwner = await createTicket({
      currentStatus: "Waiting for Requester",
      ownerIdValue: ownerId,
    });

    const inactiveResponse = await postStatus(
      inactiveOwner.id,
      { currentStatus: "In Progress", version: 1 },
      staff
    ).expect(409);
    assert.equal(readError(inactiveResponse).code, "OWNER_REQUIRED");

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: inactiveOwner.id },
    });
    assert.equal(stored.currentStatus, "WaitingForRequester");
    assert.equal(stored.version, 1);
  });

  it("rejects an Owner who must change password before In Progress", async () => {
    const activeFixture = getFixture();
    const mustChangeOwner = await activeFixture.createUser({
      displayName: "Must Change Owner",
      email: "must-change-owner@example.test",
      mustChangePassword: true,
      role: "ITStaff",
    });
    const ticket = await createTicket({
      currentStatus: "Waiting for Requester",
      ownerIdValue: mustChangeOwner.id,
    });

    const response = await postStatus(
      ticket.id,
      { currentStatus: "In Progress", version: 1 },
      staff
    ).expect(409);
    assert.equal(readError(response).code, "OWNER_REQUIRED");

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(stored.currentStatus, "WaitingForRequester");
    assert.equal(stored.version, 1);
  });

  it("rejects a Staff actor who must change password in the status repository", async () => {
    const activeFixture = getFixture();
    const mustChangeStaff = await activeFixture.createUser({
      displayName: "Must Change Status Staff",
      email: "must-change-status-staff@example.test",
      mustChangePassword: true,
      role: "ITStaff",
    });
    const ticket = await createTicket({
      currentStatus: "Waiting for Requester",
      ownerIdValue: ownerId,
    });
    const { updateTicketStatus } =
      await import("../../src/repositories/ticket-workflow.js");

    assert.deepEqual(
      await updateTicketStatus(
        mustChangeStaff.id,
        ticket.id,
        "InProgress",
        1
      ),
      { kind: "actor-ineligible" }
    );

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(stored.currentStatus, "WaitingForRequester");
    assert.equal(stored.version, 1);
  });

  it("keeps legacy terminal Tickets readable with no synthetic status history", async () => {
    const activeFixture = getFixture();
    const resolvedAt = new Date("2026-09-01T09:00:00.000Z");
    const legacyTickets = await Promise.all(
      (["Resolved", "Closed", "Cancelled"] as const).map(
        async (currentStatus, index) =>
          await activeFixture.prisma.ticket.create({
            data: {
              categoryId,
              currentStatus,
              description:
                "A legacy terminal fixture Ticket with enough detail.",
              itPriority: "Medium",
              relatedSystemId,
              requestedPriority: "Medium",
              requesterId,
              resolvedAt,
              statusChangedAt: resolvedAt,
              summary: "Legacy terminal fixture Ticket",
              ticketDate: resolvedAt,
              ticketNumber: `TKT-20260901-LEG00${index + 1}`,
              updatedAt: resolvedAt,
            },
          })
      )
    );

    await Promise.all(
      legacyTickets.map(async (ticket) => {
        const detail = await request(activeFixture.app)
          .get(`/api/tickets/${ticket.id}`)
          .set("Cookie", requester.cookie)
          .expect(200);
        assert.equal(
          asJsonObject(detail.body).currentStatus,
          ticket.currentStatus
        );
        assert.equal(
          asJsonObject(detail.body).resolvedAt,
          resolvedAt.toISOString()
        );

        const history = await request(activeFixture.app)
          .get(`/api/tickets/${ticket.id}/status-history`)
          .set("Cookie", requester.cookie)
          .expect(200);
        assert.deepEqual(asJsonObject(history.body).items, []);
        assert.equal(asJsonObject(history.body).totalItems, 0);
      })
    );
  });

  it("records only post-rollout transitions for a legacy Resolved Ticket", async () => {
    const activeFixture = getFixture();
    const resolvedAt = new Date("2026-09-01T09:00:00.000Z");
    const ticket = await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: "Resolved",
        description: "A legacy Resolved fixture Ticket with enough detail.",
        itPriority: "Medium",
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        resolvedAt,
        statusChangedAt: resolvedAt,
        summary: "Legacy Resolved fixture Ticket",
        ticketDate: resolvedAt,
        ticketNumber: "TKT-20260901-LEG900",
        updatedAt: resolvedAt,
      },
    });

    await postStatus(
      ticket.id,
      { currentStatus: "Reopened", version: 1 },
      staff
    ).expect(200);

    const history = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/status-history`)
      .set(authHeaders(staff))
      .expect(200);
    const body = asJsonObject(history.body);
    assert.equal(body.totalItems, 1);
    assert.deepEqual(
      asJsonObjectArray(body.items).map((event) => ({
        fromStatus: event.fromStatus,
        ticketVersion: event.ticketVersion,
        toStatus: event.toStatus,
      })),
      [{ fromStatus: "Resolved", ticketVersion: 2, toStatus: "Reopened" }]
    );
  });

  it("treats the Requester resolution indication as advisory and idempotent", async () => {
    const activeFixture = getFixture();
    const otherRequesterEmail = "workflow-other-requester@example.test";
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await activeFixture.createUser({
      displayName: "Workflow Other Requester",
      email: otherRequesterEmail,
      role: "Requester",
    });
    const otherRequester =
      await activeFixture.authenticate(otherRequesterEmail);

    const first = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({})
      .expect(200);
    const firstIndication = asJsonObject(
      asJsonObject(first.body).resolutionIndication
    );
    assert.deepEqual(asJsonObject(firstIndication.author), {
      displayName: "Workflow Requester",
      id: requesterId,
    });

    const indicated = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(indicated.currentStatus, "InProgress");
    assert.equal(indicated.version, 2);
    assert.equal(indicated.resolutionIndicatedByUserId, requesterId);
    assert.ok(indicated.resolutionIndicatedAt !== null);

    await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({})
      .expect(200);

    const repeated = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(repeated.currentStatus, "InProgress");
    assert.equal(repeated.version, 2);
    assert.deepEqual(
      repeated.resolutionIndicatedAt,
      indicated.resolutionIndicatedAt
    );

    const foreign = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(otherRequester))
      .send({})
      .expect(404);
    assert.equal(readError(foreign).code, "RESOURCE_NOT_FOUND");

    const staffWrite = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(staff))
      .send({})
      .expect(403);
    assert.equal(readError(staffWrite).code, "FORBIDDEN");

    const withVersion = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(authHeaders(requester))
      .send({ version: 2 })
      .expect(400);
    assert.equal(readError(withVersion).code, "VALIDATION_ERROR");

    const unchanged = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(unchanged.currentStatus, "InProgress");
    assert.equal(unchanged.version, 2);
    assert.equal(unchanged.resolutionIndicatedByUserId, requesterId);
  });

  it("lets exactly one of a racing Action create and Resolved transition win", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Completed", ticketId: ticket.id });

    const [actionResponse, statusResponse] = await Promise.all([
      request(activeFixture.app)
        .post(`/api/tickets/${ticket.id}/actions`)
        .set(authHeaders(staff))
        .send({
          assigneeId: ownerId,
          description: "Racing Planned Action Taken.",
          followUpRequired: false,
          requestId: randomUUID(),
          version: 1,
        }),
      postStatus(
        ticket.id,
        { confirmed: true, currentStatus: "Resolved", version: 1 },
        staff
      ),
    ]);

    const actionWon = actionResponse.status === 201;
    const statusWon = statusResponse.status === 200;
    assert.ok(actionWon !== statusWon, "Exactly one racing write must win.");

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    const pendingActions = await activeFixture.prisma.actionTaken.count({
      where: { status: { in: ["Planned", "InProgress"] }, ticketId: ticket.id },
    });

    if (statusWon) {
      assert.equal(stored.currentStatus, "Resolved");
      assert.equal(stored.version, 2);
      assert.equal(pendingActions, 0);
      assert.equal(actionResponse.status, 409, actionResponse.text);
      assert.ok(
        ["TICKET_TERMINAL", "VERSION_CONFLICT"].includes(
          String(readError(actionResponse).code)
        )
      );
    } else {
      assert.equal(stored.currentStatus, "InProgress");
      assert.equal(stored.version, 2);
      assert.equal(pendingActions, 1);
      assert.equal(statusResponse.status, 409, statusResponse.text);
      assert.equal(readError(statusResponse).code, "VERSION_CONFLICT");
    }
  });

  it("lets exactly one of a racing owner deactivation and Resolved transition win", async () => {
    const activeFixture = getFixture();
    const administratorEmail = "workflow-administrator@example.test";
    await activeFixture.createUser({
      displayName: "Workflow Administrator",
      email: administratorEmail,
      role: "Administrator",
    });
    const administrator = await activeFixture.authenticate(administratorEmail);
    const ticket = await createTicket({
      currentStatus: "In Progress",
      ownerIdValue: ownerId,
    });
    await createActionTaken({ status: "Completed", ticketId: ticket.id });

    const [deactivation, statusResponse] = await Promise.all([
      request(activeFixture.app)
        .patch(`/api/users/${ownerId}`)
        .set(authHeaders(administrator))
        .send({ isActive: false }),
      postStatus(
        ticket.id,
        { confirmed: true, currentStatus: "Resolved", version: 1 },
        staff
      ),
    ]);
    assert.equal(deactivation.status, 200, deactivation.text);

    const owner = await activeFixture.prisma.user.findUniqueOrThrow({
      where: { id: ownerId },
    });
    assert.equal(owner.isActive, false);

    const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    if (statusResponse.status === 200) {
      assert.equal(stored.currentStatus, "Resolved");
      assert.equal(stored.version, 2);
    } else {
      // Deactivation clears the owner and bumps the Ticket version in one
      // transaction, so the stale status write (version 1) loses on BR-16.
      assert.equal(statusResponse.status, 409, statusResponse.text);
      assert.equal(readError(statusResponse).code, "VERSION_CONFLICT");
      assert.equal(stored.currentStatus, "InProgress");
      assert.equal(stored.version, 2);
      assert.equal(stored.ownerId, null);
    }
  });
});
