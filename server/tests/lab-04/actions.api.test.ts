import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { Prisma } from "../../src/generated/prisma/client.js";
import {
  createUsersAdminFixture,
  TEST_ORIGIN,
} from "../helpers/users-admin-fixture.js";
import type {
  AuthenticatedFixtureSession,
  UsersAdminFixture,
} from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;

const requesterEmail = "actions-requester@example.test";
const staffEmail = "actions-staff@example.test";
const assigneeEmail = "actions-assignee@example.test";
const adminEmail = "actions-admin@example.test";

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

  return value.map((item) => asJsonObject(item));
};

const getJsonNumber = (value: unknown, field: string): number => {
  const object = asJsonObject(value);
  const fieldValue = object[field];

  if (typeof fieldValue !== "number") {
    throw new TypeError(`Expected ${field} to be a number.`);
  }

  return fieldValue;
};

const waitForActionUserLock = async (
  activeFixture: UsersAdminFixture
): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Poll the database lock state.
    const rows = await activeFixture.prisma.$queryRaw<
      { waiters: bigint }[]
    >(Prisma.sql`
      SELECT count(*)::bigint AS "waiters"
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%FOR UPDATE%'
    `);

    if (Number(rows[0]?.waiters ?? 0) > 0) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Poll the database lock state.
    await delay(10);
  }

  throw new Error("The Action Taken request did not wait for the User lock.");
};

const waitForActionTicketLock = async (
  activeFixture: UsersAdminFixture
): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Poll the database lock state.
    const rows = await activeFixture.prisma.$queryRaw<
      { waiters: bigint }[]
    >(Prisma.sql`
      SELECT count(*)::bigint AS "waiters"
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND query LIKE '%Ticket%'
        AND query LIKE '%FOR UPDATE%'
    `);

    if (Number(rows[0]?.waiters ?? 0) > 0) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Poll the database lock state.
    await delay(10);
  }

  throw new Error("The Action Taken request did not wait for the Ticket lock.");
};

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

const errorCode = (response: { body: unknown }): string => {
  const body = asJsonObject(response.body);
  const error = asJsonObject(body.error);
  const { code } = error;

  if (typeof code !== "string") {
    throw new TypeError("Expected an API error code.");
  }

  return code;
};

describe("Lab 4 Action Taken create and list API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let assigneeId: number;
  let adminId: number;
  let inactiveAssigneeId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketSequence = 0;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }

    return fixture;
  };

  const createTicket = async (
    currentStatus: "New" | "Resolved" | "Closed" | "Cancelled" = "New",
    ticketRequesterId = requesterId
  ) => {
    const activeFixture = getFixture();
    const ticketDate = new Date("2026-09-30T04:00:00.000Z");
    ticketSequence += 1;

    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus,
        description:
          "An API fixture Ticket with enough detail for action work.",
        itPriority: "Medium",
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId: ticketRequesterId,
        statusChangedAt: ticketDate,
        summary: "Action API fixture Ticket",
        ticketDate,
        ticketNumber: `TKT-20260930-ACT${ticketSequence.toString().padStart(3, "0")}`,
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
    ticketSequence = 0;
    const requesterUser = await activeFixture.createUser({
      displayName: "Actions Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Actions Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const assigneeUser = await activeFixture.createUser({
      displayName: "Actions Assignee",
      email: assigneeEmail,
      role: "ITStaff",
    });
    const adminUser = await activeFixture.createUser({
      displayName: "Actions Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const inactiveAssignee = await activeFixture.createUser({
      displayName: "Inactive Actions Assignee",
      email: "inactive-actions-assignee@example.test",
      isActive: false,
      role: "ITStaff",
    });

    const category = await activeFixture.prisma.category.create({
      data: { name: "Actions Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Actions System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    assigneeId = assigneeUser.id;
    adminId = adminUser.id;
    inactiveAssigneeId = inactiveAssignee.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("creates a Planned Action Taken with server attribution and one immutable event", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        attachmentNotes: "  See the existing cable photo.  ",
        description: "  Replace the damaged network cable.  ",
        followUpNote: "  Confirm connectivity with the requester.  ",
        followUpRequired: true,
        requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
        result: "  Cable is ready to be replaced.  ",
        version: 1,
      })
      .expect(201);

    const body = asJsonObject(response.body);
    const action = asJsonObject(body.action);
    const responseTicket = asJsonObject(body.ticket);

    const actionKeys = Object.keys(action);
    // oxlint-disable-next-line no-array-sort
    actionKeys.sort();
    assert.deepEqual(actionKeys, [
      "assignee",
      "attachmentNotes",
      "cancelledAt",
      "cancelledBy",
      "completedAt",
      "completedBy",
      "createdAt",
      "createdBy",
      "description",
      "followUpNote",
      "followUpRequired",
      "id",
      "performedBy",
      "result",
      "startedAt",
      "status",
      "ticketId",
      "updatedAt",
      "version",
    ]);
    assert.equal(action.ticketId, ticket.id);
    assert.equal(action.description, "Replace the damaged network cable.");
    assert.equal(action.result, "Cable is ready to be replaced.");
    assert.deepEqual(action.assignee, {
      displayName: "Actions Assignee",
      id: assigneeId,
      isActive: true,
      isEligible: true,
      role: "IT Staff",
    });
    assert.deepEqual(action.createdBy, {
      displayName: "Actions Staff",
      id: staffId,
      role: "IT Staff",
    });
    assert.equal(action.performedBy, null);
    assert.equal(action.status, "Planned");
    assert.equal(action.version, 1);
    assert.equal(action.followUpRequired, true);
    assert.equal(
      action.followUpNote,
      "Confirm connectivity with the requester."
    );
    assert.equal(action.attachmentNotes, "See the existing cable photo.");
    assert.equal(responseTicket.version, 2);

    const actionId = getJsonNumber(action, "id");
    const storedAction = await activeFixture.prisma.actionTaken.findUnique({
      where: { id: actionId },
    });
    assert.equal(storedAction?.createdByUserId, staffId);
    assert.equal(storedAction?.assigneeId, assigneeId);
    assert.equal(storedAction?.status, "Planned");

    const events = await activeFixture.prisma.actionEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { actionId },
    });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      actionId: action.id,
      actionVersion: 1,
      actorId: staffId,
      createdAt: events[0]?.createdAt,
      eventType: "ActionCreated",
      fromStatus: null,
      id: events[0]?.id,
      snapshot: {
        assigneeId,
        attachmentNotes: "See the existing cable photo.",
        description: "Replace the damaged network cable.",
        followUpNote: "Confirm connectivity with the requester.",
        followUpRequired: true,
        result: "Cable is ready to be replaced.",
        status: "Planned",
      },
      toStatus: "Planned",
    });
  });

  it("starts a Planned action with authenticated performer and one lifecycle event", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Start the cable replacement.",
        followUpRequired: false,
        requestId: "c5726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");

    const requesterWrite = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
      .set(authHeaders(requester))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .expect(403);
    assert.equal(errorCode(requesterWrite), "FORBIDDEN");
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );

    const started = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
      .set(authHeaders(admin))
      .send({
        actionVersion: 1,
        ticketVersion: 2,
        toStatus: "In Progress",
      })
      .expect(200);

    const action = asJsonObject(asJsonObject(started.body).action);
    const responseTicket = asJsonObject(asJsonObject(started.body).ticket);
    assert.equal(action.status, "In Progress");
    assert.equal(action.version, 2);
    assert.deepEqual(action.performedBy, {
      displayName: "Actions Administrator",
      id: adminId,
      role: "Administrator",
    });
    assert.equal(typeof action.startedAt, "string");
    assert.equal(responseTicket.version, 3);
    assert.notEqual(responseTicket.updatedAt, ticket.updatedAt.toISOString());

    const events = await activeFixture.prisma.actionEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { actionId },
    });
    assert.equal(events.length, 2);
    assert.equal(events[1]?.eventType, "ActionStarted");
    assert.equal(events[1]?.actorId, adminId);
    assert.equal(events[1]?.actionVersion, 2);
    assert.equal(events[1]?.fromStatus, "Planned");
    assert.equal(events[1]?.toStatus, "InProgress");
    assert.equal(events[1]?.snapshot, null);

    const requesterHistory = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions/${actionId}/history`)
      .set("Cookie", requester.cookie)
      .expect(200);
    assert.equal(asJsonObject(requesterHistory.body).totalItems, 2);
  });

  it("completes an In Progress action with a Result and authenticated terminal attribution", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Replace the damaged cable.",
        followUpRequired: false,
        requestId: "d5726990-c560-45d5-ae76-2f75659bb540",
        result: "Replaced and tested both ports.",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");

    await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .expect(200);

    const completed = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
      .set(authHeaders(admin))
      .send({
        actionVersion: 2,
        confirmed: true,
        ticketVersion: 3,
        toStatus: "Completed",
      })
      .expect(200);

    const action = asJsonObject(asJsonObject(completed.body).action);
    assert.equal(action.status, "Completed");
    assert.equal(action.result, "Replaced and tested both ports.");
    assert.equal(action.version, 3);
    assert.deepEqual(action.performedBy, {
      displayName: "Actions Staff",
      id: staffId,
      role: "IT Staff",
    });
    assert.deepEqual(action.completedBy, {
      displayName: "Actions Administrator",
      id: adminId,
      role: "Administrator",
    });
    assert.equal(typeof action.completedAt, "string");
    assert.equal(
      getJsonNumber(asJsonObject(completed.body).ticket, "version"),
      4
    );

    const events = await activeFixture.prisma.actionEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { actionId },
    });
    assert.equal(events.length, 3);
    assert.equal(events[2]?.eventType, "ActionCompleted");
    assert.equal(events[2]?.actorId, adminId);
    assert.equal(events[2]?.actionVersion, 3);
    assert.equal(events[2]?.fromStatus, "InProgress");
    assert.equal(events[2]?.toStatus, "Completed");
    assert.equal(events[2]?.snapshot, null);

    const requesterHistory = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions/${actionId}/history`)
      .set("Cookie", requester.cookie)
      .expect(200);
    const historyItems = asJsonArray(asJsonObject(requesterHistory.body).items);
    assert.deepEqual(
      historyItems.map((item) => item.eventType),
      ["ActionCreated", "ActionStarted", "ActionCompleted"]
    );
    assert.equal(historyItems.at(-1)?.eventType, "ActionCompleted");
    assert.equal(getJsonNumber(historyItems.at(-1)?.actor, "id"), adminId);
  });

  it("cancels Planned and In Progress actions with immutable actor and time records", async () => {
    const activeFixture = getFixture();
    const plannedTicket = await createTicket();
    const plannedCreated = await request(activeFixture.app)
      .post(`/api/tickets/${plannedTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Cancel work before it starts.",
        followUpRequired: false,
        requestId: "e5726990-c560-45d5-ae76-2f75659bb540",
        version: plannedTicket.version,
      })
      .expect(201);
    const plannedActionId = getJsonNumber(
      asJsonObject(plannedCreated.body).action,
      "id"
    );

    const cancelledPlanned = await request(activeFixture.app)
      .post(
        `/api/tickets/${plannedTicket.id}/actions/${plannedActionId}/transition`
      )
      .set(authHeaders(admin))
      .send({
        actionVersion: 1,
        confirmed: true,
        ticketVersion: 2,
        toStatus: "Cancelled",
      })
      .expect(200);
    const plannedAction = asJsonObject(
      asJsonObject(cancelledPlanned.body).action
    );
    assert.equal(plannedAction.status, "Cancelled");
    assert.equal(plannedAction.performedBy, null);
    assert.deepEqual(plannedAction.cancelledBy, {
      displayName: "Actions Administrator",
      id: adminId,
      role: "Administrator",
    });
    assert.equal(typeof plannedAction.cancelledAt, "string");

    const runningTicket = await createTicket();
    const runningCreated = await request(activeFixture.app)
      .post(`/api/tickets/${runningTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Start then cancel work.",
        followUpRequired: false,
        requestId: "f5726990-c560-45d5-ae76-2f75659bb540",
        version: runningTicket.version,
      })
      .expect(201);
    const runningActionId = getJsonNumber(
      asJsonObject(runningCreated.body).action,
      "id"
    );
    await request(activeFixture.app)
      .post(
        `/api/tickets/${runningTicket.id}/actions/${runningActionId}/transition`
      )
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .expect(200);

    const cancelledRunning = await request(activeFixture.app)
      .post(
        `/api/tickets/${runningTicket.id}/actions/${runningActionId}/transition`
      )
      .set(authHeaders(admin))
      .send({
        actionVersion: 2,
        confirmed: true,
        ticketVersion: 3,
        toStatus: "Cancelled",
      })
      .expect(200);
    const runningAction = asJsonObject(
      asJsonObject(cancelledRunning.body).action
    );
    assert.equal(runningAction.status, "Cancelled");
    assert.deepEqual(runningAction.performedBy, {
      displayName: "Actions Staff",
      id: staffId,
      role: "IT Staff",
    });
    assert.equal(getJsonNumber(runningAction.cancelledBy, "id"), adminId);
    assert.equal(typeof runningAction.cancelledAt, "string");

    // oxlint-disable no-await-in-loop -- Verify each cancelled action's final event.
    for (const [actionId, fromStatus] of [
      [plannedActionId, "Planned"],
      [runningActionId, "InProgress"],
    ] as const) {
      const events = await activeFixture.prisma.actionEvent.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { actionId },
      });
      const terminalEvent = events.at(-1);
      assert.equal(terminalEvent?.eventType, "ActionCancelled");
      assert.equal(terminalEvent?.actorId, adminId);
      assert.equal(terminalEvent?.fromStatus, fromStatus);
      assert.equal(terminalEvent?.toStatus, "Cancelled");
      assert.equal(terminalEvent?.snapshot, null);
    }
    // oxlint-enable no-await-in-loop
  });

  it("rejects invalid edges and terminal transitions without changing the Action Taken", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Keep the action Planned after rejected transitions.",
        followUpRequired: false,
        requestId: "a6726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const transitionPath = `/api/tickets/${ticket.id}/actions/${actionId}/transition`;

    const missingConfirmation = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "Cancelled" })
      .expect(400);
    assert.equal(errorCode(missingConfirmation), "CONFIRMATION_REQUIRED");

    const falseConfirmation = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({
        actionVersion: 1,
        confirmed: false,
        ticketVersion: 2,
        toStatus: "Cancelled",
      })
      .expect(400);
    assert.equal(errorCode(falseConfirmation), "CONFIRMATION_REQUIRED");

    const confirmationOnStart = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({
        actionVersion: 1,
        confirmed: true,
        ticketVersion: 2,
        toStatus: "In Progress",
      })
      .expect(400);
    assert.equal(errorCode(confirmationOnStart), "VALIDATION_ERROR");

    const invalidEdge = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({
        actionVersion: 1,
        confirmed: true,
        ticketVersion: 2,
        toStatus: "Completed",
      })
      .expect(409);
    assert.equal(errorCode(invalidEdge), "INVALID_TRANSITION");

    const selfTransition = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "Planned" })
      .expect(409);
    assert.equal(errorCode(selfTransition), "INVALID_TRANSITION");

    const storedAction =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    const storedTicket = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(storedAction.status, "Planned");
    assert.equal(storedAction.version, 1);
    assert.equal(storedTicket.version, 2);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );
  });

  it("rejects repeated transitions from Completed and Cancelled actions", async () => {
    const activeFixture = getFixture();
    const completedTicket = await createTicket();
    const completedCreated = await request(activeFixture.app)
      .post(`/api/tickets/${completedTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Complete once and retain the terminal record.",
        followUpRequired: false,
        requestId: "a7726990-c560-45d5-ae76-2f75659bb540",
        result: "Replaced the cable and tested both ports.",
        version: completedTicket.version,
      })
      .expect(201);
    const completedActionId = getJsonNumber(
      asJsonObject(completedCreated.body).action,
      "id"
    );
    const completedPath = `/api/tickets/${completedTicket.id}/actions/${completedActionId}/transition`;

    await request(activeFixture.app)
      .post(completedPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .expect(200);
    await request(activeFixture.app)
      .post(completedPath)
      .set(authHeaders(admin))
      .send({
        actionVersion: 2,
        confirmed: true,
        ticketVersion: 3,
        toStatus: "Completed",
      })
      .expect(200);

    const completedRetry = await request(activeFixture.app)
      .post(completedPath)
      .set(authHeaders(admin))
      .send({
        actionVersion: 3,
        confirmed: true,
        ticketVersion: 4,
        toStatus: "Cancelled",
      })
      .expect(409);
    assert.equal(errorCode(completedRetry), "ACTION_TERMINAL");
    const completedStored =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: completedActionId },
      });
    assert.equal(completedStored.status, "Completed");
    assert.equal(completedStored.version, 3);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({
        where: { actionId: completedActionId },
      }),
      3
    );
    const completedTicketStored =
      await activeFixture.prisma.ticket.findUniqueOrThrow({
        where: { id: completedTicket.id },
      });
    assert.equal(completedTicketStored.version, 4);

    const cancelledTicket = await createTicket();
    const cancelledCreated = await request(activeFixture.app)
      .post(`/api/tickets/${cancelledTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Cancel once and retain the terminal record.",
        followUpRequired: false,
        requestId: "b7726990-c560-45d5-ae76-2f75659bb540",
        version: cancelledTicket.version,
      })
      .expect(201);
    const cancelledActionId = getJsonNumber(
      asJsonObject(cancelledCreated.body).action,
      "id"
    );
    const cancelledPath = `/api/tickets/${cancelledTicket.id}/actions/${cancelledActionId}/transition`;
    await request(activeFixture.app)
      .post(cancelledPath)
      .set(authHeaders(admin))
      .send({
        actionVersion: 1,
        confirmed: true,
        ticketVersion: 2,
        toStatus: "Cancelled",
      })
      .expect(200);

    const cancelledRetry = await request(activeFixture.app)
      .post(cancelledPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 2, ticketVersion: 3, toStatus: "In Progress" })
      .expect(409);
    assert.equal(errorCode(cancelledRetry), "ACTION_TERMINAL");
    const cancelledStored =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: cancelledActionId },
      });
    assert.equal(cancelledStored.status, "Cancelled");
    assert.equal(cancelledStored.version, 2);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({
        where: { actionId: cancelledActionId },
      }),
      2
    );
    const cancelledTicketStored =
      await activeFixture.prisma.ticket.findUniqueOrThrow({
        where: { id: cancelledTicket.id },
      });
    assert.equal(cancelledTicketStored.version, 3);
  });

  it("blocks completion until Result exists and required follow-up is cleared", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Complete follow-up before closing this work item.",
        followUpNote: "Confirm the repair with the requester.",
        followUpRequired: true,
        requestId: "b6726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const transitionPath = `/api/tickets/${ticket.id}/actions/${actionId}/transition`;

    await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .expect(200);

    const missingResult = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(admin))
      .send({
        actionVersion: 2,
        confirmed: true,
        ticketVersion: 3,
        toStatus: "Completed",
      })
      .expect(409);
    assert.equal(errorCode(missingResult), "RESULT_REQUIRED");

    const unchangedAfterMissingResult =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    assert.equal(unchangedAfterMissingResult.status, "InProgress");
    assert.equal(unchangedAfterMissingResult.version, 2);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      2
    );

    await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send({
        actionVersion: 2,
        assigneeId: staffId,
        attachmentNotes: null,
        description: "Complete follow-up before closing this work item.",
        followUpNote: "Confirm the repair with the requester.",
        followUpRequired: true,
        result: "Replaced the cable and verified both ports.",
        ticketVersion: 3,
      })
      .expect(200);

    const unresolvedFollowUp = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(admin))
      .send({
        actionVersion: 3,
        confirmed: true,
        ticketVersion: 4,
        toStatus: "Completed",
      })
      .expect(409);
    assert.equal(errorCode(unresolvedFollowUp), "FOLLOW_UP_UNRESOLVED");

    const unchangedAfterFollowUp =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    assert.equal(unchangedAfterFollowUp.status, "InProgress");
    assert.equal(unchangedAfterFollowUp.version, 3);
    assert.equal(unchangedAfterFollowUp.followUpRequired, true);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      3
    );

    await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send({
        actionVersion: 3,
        assigneeId: staffId,
        attachmentNotes: null,
        description: "Complete follow-up before closing this work item.",
        followUpNote: null,
        followUpRequired: false,
        result: "Replaced the cable and verified both ports.",
        ticketVersion: 4,
      })
      .expect(200);

    const completed = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(admin))
      .send({
        actionVersion: 4,
        confirmed: true,
        ticketVersion: 5,
        toStatus: "Completed",
      })
      .expect(200);
    assert.equal(
      asJsonObject(asJsonObject(completed.body).action).status,
      "Completed"
    );
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      5
    );
  });

  it("serializes lifecycle writes on the parent Ticket and avoids duplicate terminal events", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Serialize this lifecycle under its parent Ticket.",
        followUpRequired: false,
        requestId: "c6726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const transitionPath = `/api/tickets/${ticket.id}/actions/${actionId}/transition`;

    const staleActionVersion = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 2, ticketVersion: 2, toStatus: "In Progress" })
      .expect(409);
    assert.equal(errorCode(staleActionVersion), "VERSION_CONFLICT");

    const staleTicketVersion = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 1, toStatus: "In Progress" })
      .expect(409);
    assert.equal(errorCode(staleTicketVersion), "VERSION_CONFLICT");

    const historyAfterStale = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions/${actionId}/history`)
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.equal(asJsonObject(historyAfterStale.body).totalItems, 1);

    let releaseTicket!: () => void;
    let markTicketLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the parent Ticket row until the transition waits.
    const ticketRelease = new Promise<void>((resolve) => {
      releaseTicket = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal when the test owns the parent Ticket row lock.
    const ticketLocked = new Promise<void>((resolve) => {
      markTicketLocked = resolve;
    });
    const parentLock = activeFixture.prisma.$transaction(async (database) => {
      await database.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticket.id} FOR UPDATE`
      );
      markTicketLocked();
      await ticketRelease;
    });

    await ticketLocked;
    const startRequest = request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .then((response) => response);
    let ticketLockError: unknown;
    try {
      await waitForActionTicketLock(activeFixture);
    } catch (error: unknown) {
      ticketLockError = error;
    } finally {
      releaseTicket();
    }

    const started = await startRequest;
    await parentLock;
    if (ticketLockError instanceof Error) {
      throw ticketLockError;
    }
    assert.equal(started.status, 200);
    assert.equal(
      getJsonNumber(asJsonObject(started.body).ticket, "version"),
      3
    );

    const cancellationBody = {
      actionVersion: 2,
      confirmed: true,
      ticketVersion: 3,
      toStatus: "Cancelled",
    };
    const cancellations = await Promise.all(
      [0, 1].map(
        async () =>
          await request(activeFixture.app)
            .post(transitionPath)
            .set(authHeaders(admin))
            .send(cancellationBody)
            .then((response) => response)
      )
    );
    assert.equal(
      cancellations.filter((response) => response.status === 200).length,
      1
    );
    assert.equal(
      cancellations.filter((response) => response.status === 409).length,
      1
    );
    const rejectedCancellation = cancellations.find(
      (response) => response.status === 409
    );
    assert.ok(rejectedCancellation);
    assert.equal(errorCode(rejectedCancellation), "VERSION_CONFLICT");

    const winningCancellation = cancellations.find(
      (response) => response.status === 200
    );
    assert.ok(winningCancellation);
    assert.equal(
      asJsonObject(asJsonObject(winningCancellation.body).action).status,
      "Cancelled"
    );
    assert.equal(
      getJsonNumber(asJsonObject(winningCancellation.body).ticket, "version"),
      4
    );

    const history = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions/${actionId}/history`)
      .set("Cookie", staff.cookie)
      .expect(200);
    const events = asJsonArray(asJsonObject(history.body).items);
    assert.equal(asJsonObject(history.body).totalItems, 3);
    assert.deepEqual(
      events.map((event) => event.eventType),
      ["ActionCreated", "ActionStarted", "ActionCancelled"]
    );
  });

  it("rejects lifecycle writes on every terminal Ticket status", async () => {
    const activeFixture = getFixture();
    const statuses = ["Resolved", "Closed", "Cancelled"] as const;

    await Promise.all(
      statuses.map(async (status, index) => {
        const ticket = await createTicket();
        const created = await request(activeFixture.app)
          .post(`/api/tickets/${ticket.id}/actions`)
          .set(authHeaders(staff))
          .send({
            description: `Terminal parent ${status}.`,
            followUpRequired: false,
            requestId: `d6726990-c560-45d5-ae76-2f75659bb55${index}`,
            version: ticket.version,
          })
          .expect(201);
        const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
        await activeFixture.prisma.ticket.update({
          data: { currentStatus: status },
          where: { id: ticket.id },
        });

        const rejected = await request(activeFixture.app)
          .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
          .set(authHeaders(admin))
          .send({
            actionVersion: 1,
            confirmed: true,
            ticketVersion: 2,
            toStatus: "Cancelled",
          })
          .expect(409);
        assert.equal(errorCode(rejected), "TICKET_TERMINAL");

        const history = await request(activeFixture.app)
          .get(`/api/tickets/${ticket.id}/actions/${actionId}/history`)
          .set("Cookie", staff.cookie)
          .expect(200);
        assert.equal(asJsonObject(history.body).totalItems, 1);
      })
    );
  });

  it("rechecks actor and assignee eligibility when role changes race a start", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        description: "Only eligible users can start this action.",
        followUpRequired: false,
        requestId: "e6726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const transitionPath = `/api/tickets/${ticket.id}/actions/${actionId}/transition`;

    let releaseActor!: () => void;
    let markActorLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the acting User row until the transition waits.
    const actorRelease = new Promise<void>((resolve) => {
      releaseActor = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal that the actor role change is in flight.
    const actorLocked = new Promise<void>((resolve) => {
      markActorLocked = resolve;
    });
    const actorDemotion = activeFixture.prisma.$transaction(
      async (database) => {
        await database.$queryRaw(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${staffId} FOR UPDATE`
        );
        await database.user.update({
          data: { role: "Requester" },
          where: { id: staffId },
        });
        markActorLocked();
        await actorRelease;
      }
    );

    await actorLocked;
    const actorRequest = request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .then((response) => response);
    let actorLockError: unknown;
    try {
      await waitForActionUserLock(activeFixture);
    } catch (error: unknown) {
      actorLockError = error;
    } finally {
      releaseActor();
    }
    const actorResponse = await actorRequest;
    await actorDemotion;
    if (actorLockError instanceof Error) {
      throw actorLockError;
    }
    assert.equal(actorResponse.status, 403);
    assert.equal(errorCode(actorResponse), "FORBIDDEN");

    await activeFixture.prisma.user.update({
      data: { role: "ITStaff" },
      where: { id: staffId },
    });

    let releaseAssignee!: () => void;
    let markAssigneeLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the assignee row until the transition waits.
    const assigneeRelease = new Promise<void>((resolve) => {
      releaseAssignee = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal that the assignee role change is in flight.
    const assigneeLocked = new Promise<void>((resolve) => {
      markAssigneeLocked = resolve;
    });
    const assigneeDemotion = activeFixture.prisma.$transaction(
      async (database) => {
        await database.$queryRaw(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${assigneeId} FOR UPDATE`
        );
        await database.user.update({
          data: { role: "Requester" },
          where: { id: assigneeId },
        });
        markAssigneeLocked();
        await assigneeRelease;
      }
    );

    await assigneeLocked;
    const assigneeRequest = request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(admin))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .then((response) => response);
    let assigneeLockError: unknown;
    try {
      await waitForActionUserLock(activeFixture);
    } catch (error: unknown) {
      assigneeLockError = error;
    } finally {
      releaseAssignee();
    }
    const assigneeResponse = await assigneeRequest;
    await assigneeDemotion;
    if (assigneeLockError instanceof Error) {
      throw assigneeLockError;
    }
    assert.equal(assigneeResponse.status, 409);
    assert.equal(errorCode(assigneeResponse), "ACTION_ASSIGNEE_INELIGIBLE");

    const history = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions/${actionId}/history`)
      .set("Cookie", admin.cookie)
      .expect(200);
    assert.equal(asJsonObject(history.body).totalItems, 1);
    const actions = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions`)
      .set("Cookie", admin.cookie)
      .expect(200);
    const [action] = asJsonArray(asJsonObject(actions.body).items);
    assert.equal(action?.status, "Planned");
    assert.equal(action?.version, 1);
  });

  it("rejects a transition with VERSION_CONFLICT when the assignee changes after the snapshot read", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        description: "Reassignment must not skip the new assignee lock.",
        followUpRequired: false,
        requestId: "f7726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");

    let releaseTicket!: () => void;
    let markTicketLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the parent Ticket row until the transition waits.
    const ticketRelease = new Promise<void>((resolve) => {
      releaseTicket = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal when the test owns the parent Ticket row lock.
    const ticketLocked = new Promise<void>((resolve) => {
      markTicketLocked = resolve;
    });
    const reassignment = activeFixture.prisma.$transaction(async (database) => {
      await database.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticket.id} FOR UPDATE`
      );
      markTicketLocked();
      await ticketRelease;
      // The snapshot read already happened; change the assignee before the lock.
      await database.actionTaken.update({
        data: { assigneeId: adminId },
        where: { id: actionId },
      });
    });

    await ticketLocked;
    const startRequest = request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .then((response) => response);
    let ticketLockError: unknown;
    try {
      await waitForActionTicketLock(activeFixture);
    } catch (error: unknown) {
      ticketLockError = error;
    } finally {
      releaseTicket();
    }

    const response = await startRequest;
    await reassignment;
    if (ticketLockError instanceof Error) {
      throw ticketLockError;
    }
    assert.equal(response.status, 409);
    assert.equal(errorCode(response), "VERSION_CONFLICT");
    const stored = await activeFixture.prisma.actionTaken.findUniqueOrThrow({
      where: { id: actionId },
    });
    assert.equal(stored.status, "Planned");
    assert.equal(stored.assigneeId, adminId);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );
  });

  it("rejects a transition with ACCOUNT_INACTIVE when the actor is deactivated while waiting", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        description: "A deactivated actor must not start this action.",
        followUpRequired: false,
        requestId: "a8726990-c560-45d5-ae76-2f75659bb540",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");

    let releaseActor!: () => void;
    let markActorLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the acting User row until the transition waits.
    const actorRelease = new Promise<void>((resolve) => {
      releaseActor = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal that the actor deactivation is in flight.
    const actorLocked = new Promise<void>((resolve) => {
      markActorLocked = resolve;
    });
    const deactivation = activeFixture.prisma.$transaction(async (database) => {
      await database.$queryRaw(
        Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${staffId} FOR UPDATE`
      );
      await database.user.update({
        data: { isActive: false },
        where: { id: staffId },
      });
      markActorLocked();
      await actorRelease;
    });

    await actorLocked;
    const startRequest = request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions/${actionId}/transition`)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .then((response) => response);
    let actorLockError: unknown;
    try {
      await waitForActionUserLock(activeFixture);
    } catch (error: unknown) {
      actorLockError = error;
    } finally {
      releaseActor();
    }

    const response = await startRequest;
    await deactivation;
    if (actorLockError instanceof Error) {
      throw actorLockError;
    }
    assert.equal(response.status, 403);
    assert.equal(errorCode(response), "ACCOUNT_INACTIVE");
    const stored = await activeFixture.prisma.actionTaken.findUniqueOrThrow({
      where: { id: actionId },
    });
    assert.equal(stored.status, "Planned");
    assert.equal(stored.version, 1);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );
  });

  it("rechecks the assignee on completion but still allows cancellation", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        description: "Completion needs an eligible assignee.",
        followUpRequired: false,
        requestId: "b9726990-c560-45d5-ae76-2f75659bb540",
        result: "Work is finished.",
        version: ticket.version,
      })
      .expect(201);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const transitionPath = `/api/tickets/${ticket.id}/actions/${actionId}/transition`;
    await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({ actionVersion: 1, ticketVersion: 2, toStatus: "In Progress" })
      .expect(200);
    await activeFixture.prisma.user.update({
      data: { role: "Requester" },
      where: { id: assigneeId },
    });

    const completion = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({
        actionVersion: 2,
        confirmed: true,
        ticketVersion: 3,
        toStatus: "Completed",
      })
      .expect(409);
    assert.equal(errorCode(completion), "ACTION_ASSIGNEE_INELIGIBLE");
    const unchanged = await activeFixture.prisma.actionTaken.findUniqueOrThrow({
      where: { id: actionId },
    });
    assert.equal(unchanged.status, "InProgress");
    assert.equal(unchanged.version, 2);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      2
    );

    const cancellation = await request(activeFixture.app)
      .post(transitionPath)
      .set(authHeaders(staff))
      .send({
        actionVersion: 2,
        confirmed: true,
        ticketVersion: 3,
        toStatus: "Cancelled",
      })
      .expect(200);
    assert.equal(
      asJsonObject(asJsonObject(cancellation.body).action).status,
      "Cancelled"
    );
  });

  it("returns a safe INTERNAL_ERROR when the action store fails", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    await activeFixture.prisma.$executeRawUnsafe(
      'ALTER TABLE "ActionTaken" RENAME TO "UnavailableActionTaken"'
    );
    try {
      const response = await request(activeFixture.app)
        .get(`/api/tickets/${ticket.id}/actions`)
        .set("Cookie", requester.cookie)
        .expect(500);
      assert.equal(errorCode(response), "INTERNAL_ERROR");
      assert.equal(
        asJsonObject(asJsonObject(response.body).error).message,
        "Unable to load Actions Taken."
      );
    } finally {
      await activeFixture.prisma.$executeRawUnsafe(
        'ALTER TABLE "UnavailableActionTaken" RENAME TO "ActionTaken"'
      );
    }
  });

  it("lists own and shared actions in a stable paginated page", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();

    await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "First planned repair.",
        followUpRequired: false,
        requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(201);

    await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Second planned repair.",
        followUpRequired: false,
        requestId: "b5726990-c560-45d5-ae76-2f75659bb540",
        version: 2,
      })
      .expect(201);

    const requesterList = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions`)
      .set("Cookie", requester.cookie)
      .expect(200);
    const requesterListBody = asJsonObject(requesterList.body);
    assert.deepEqual(requesterListBody.page, 1);
    assert.deepEqual(requesterListBody.pageSize, 20);
    assert.deepEqual(requesterListBody.totalItems, 2);
    assert.deepEqual(requesterListBody.totalPages, 1);
    assert.deepEqual(
      asJsonArray(requesterListBody.items).map((item) => item.description),
      ["First planned repair.", "Second planned repair."]
    );

    const staffList = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions?page=1&pageSize=10`)
      .set("Cookie", staff.cookie)
      .expect(200);
    const staffListBody = asJsonObject(staffList.body);
    assert.equal(staffListBody.pageSize, 10);
    assert.equal(staffListBody.totalItems, 2);
    assert.equal(asJsonArray(staffListBody.items).length, 2);

    const outOfRange = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/actions?page=2147483647&pageSize=50`)
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.deepEqual(outOfRange.body, {
      items: [],
      page: 2_147_483_647,
      pageSize: 50,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it("enforces role and assignee authorization and rejects new actions on Resolved, Closed and Cancelled Tickets", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();

    const requesterWrite = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(requester))
      .send({
        description: "Requester must not create work.",
        followUpRequired: false,
        requestId: "c5726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(403);
    assert.equal(errorCode(requesterWrite), "FORBIDDEN");

    const inactiveAssignee = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId: inactiveAssigneeId,
        description: "Do not assign to inactive staff.",
        followUpRequired: false,
        requestId: "d5726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(409);
    assert.equal(errorCode(inactiveAssignee), "ACTION_ASSIGNEE_INELIGIBLE");
    assert.deepEqual(
      asJsonObject(asJsonObject(inactiveAssignee.body).error).details,
      {
        field: "assigneeId",
        reason: "Choose an active IT Staff member or Administrator.",
      }
    );

    const administratorCreate = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(admin))
      .send({
        assigneeId: adminId,
        description: "Administrator can create operational work.",
        followUpRequired: false,
        requestId: "e5726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(201);
    assert.equal(
      asJsonObject(asJsonObject(administratorCreate.body).action).status,
      "Planned"
    );

    await Promise.all(
      (["Resolved", "Closed", "Cancelled"] as const).map(async (status) => {
        const terminalTicket = await createTicket(status);
        const rejected = await request(activeFixture.app)
          .post(`/api/tickets/${terminalTicket.id}/actions`)
          .set(authHeaders(staff))
          .send({
            description: `${status} Tickets reject new work.`,
            followUpRequired: false,
            requestId: "f5726990-c560-45d5-ae76-2f75659bb540",
            version: terminalTicket.version,
          })
          .expect(409);
        assert.equal(errorCode(rejected), "TICKET_TERMINAL");
        const stored = await activeFixture.prisma.ticket.findUniqueOrThrow({
          where: { id: terminalTicket.id },
        });
        assert.equal(stored.version, terminalTicket.version);
        assert.equal(
          await activeFixture.prisma.actionTaken.count({
            where: { ticketId: terminalTicket.id },
          }),
          0
        );
      })
    );
  });

  it("rejects an assignee who must change password with ACTION_ASSIGNEE_INELIGIBLE", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const mustChangeAssignee = await activeFixture.createUser({
      displayName: "Must Change Action Assignee",
      email: "must-change-actions-assignee@example.test",
      mustChangePassword: true,
      role: "ITStaff",
    });

    const response = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId: mustChangeAssignee.id,
        description: "Do not assign work to Staff who must change password.",
        followUpRequired: false,
        requestId: "f5726990-c560-45d5-ae76-2f75659bb541",
        version: 1,
      })
      .expect(409);
    assert.equal(errorCode(response), "ACTION_ASSIGNEE_INELIGIBLE");
    assert.equal(
      await activeFixture.prisma.actionTaken.count({
        where: { ticketId: ticket.id },
      }),
      0
    );
  });

  it("rechecks an assignee after a concurrent deactivation commits", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    let releaseDeactivation!: () => void;
    let markLockReady!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- The test must hold the row lock until the request is waiting.
    const deactivationReleased = new Promise<void>((resolve) => {
      releaseDeactivation = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- The test must wait for the row lock before starting the request.
    const deactivationLockReady = new Promise<void>((resolve) => {
      markLockReady = resolve;
    });

    const deactivation = activeFixture.prisma.$transaction(async (database) => {
      await database.$queryRaw(
        Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${assigneeId} FOR UPDATE`
      );
      await database.user.update({
        data: { isActive: false },
        where: { id: assigneeId },
      });
      markLockReady();
      await deactivationReleased;
    });

    await deactivationLockReady;
    const createRequest = request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        description: "The assignee is deactivated while this request waits.",
        followUpRequired: false,
        requestId: "b8726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .then((response) => response);

    let lockWaitError: unknown;
    try {
      await waitForActionUserLock(activeFixture);
    } catch (error: unknown) {
      lockWaitError = error;
    } finally {
      releaseDeactivation();
    }

    const createResponse = await createRequest;
    await deactivation;
    if (lockWaitError !== undefined) {
      if (lockWaitError instanceof Error) {
        throw lockWaitError;
      }

      throw new Error("The Action Taken request lock wait failed.", {
        cause: lockWaitError,
      });
    }

    assert.equal(createResponse.status, 409);
    assert.equal(errorCode(createResponse), "ACTION_ASSIGNEE_INELIGIBLE");
    assert.deepEqual(
      await activeFixture.prisma.ticket.findUnique({
        select: { version: true },
        where: { id: ticket.id },
      }),
      { version: 1 }
    );
    assert.equal(
      await activeFixture.prisma.actionTaken.count({
        where: { ticketId: ticket.id },
      }),
      0
    );
    assert.equal(
      await activeFixture.prisma.actionEvent.count({
        where: { action: { ticketId: ticket.id } },
      }),
      0
    );
  });

  it("rejects spoofed fields without changing the parent", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const invalid = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        actorId: staffId,
        description: "This request contains a spoofed actor.",
        followUpRequired: false,
        requestId: "b6726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(400);
    assert.equal(errorCode(invalid), "VALIDATION_ERROR");

    const storedTicket = await activeFixture.prisma.ticket.findUnique({
      select: { version: true },
      where: { id: ticket.id },
    });
    assert.deepEqual(storedTicket, { version: 1 });
    assert.equal(
      await activeFixture.prisma.actionTaken.count({
        where: { ticketId: ticket.id },
      }),
      0
    );
  });

  it("hides a foreign Ticket action list from a Requester but shares it with staff", async () => {
    const activeFixture = getFixture();
    const otherRequester = await activeFixture.createUser({
      displayName: "Other Actions Requester",
      email: "other-actions-requester@example.test",
      role: "Requester",
    });
    const foreignTicket = await createTicket("New", otherRequester.id);

    await request(activeFixture.app)
      .post(`/api/tickets/${foreignTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "Shared staff work on another requester Ticket.",
        followUpRequired: false,
        requestId: "a8726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(201);

    const requesterRead = await request(activeFixture.app)
      .get(`/api/tickets/${foreignTicket.id}/actions`)
      .set("Cookie", requester.cookie)
      .expect(404);
    assert.equal(errorCode(requesterRead), "RESOURCE_NOT_FOUND");

    const staffRead = await request(activeFixture.app)
      .get(`/api/tickets/${foreignTicket.id}/actions`)
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.equal(asJsonObject(staffRead.body).totalItems, 1);
  });

  it("replays an identical request without a second write and conflicts on changed payloads", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const body = {
      description: "Replay-safe planned repair.",
      followUpRequired: false,
      requestId: "c6726990-c560-45d5-ae76-2f75659bb540",
      version: 1,
    };

    const first = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send(body)
      .expect(201);
    const replay = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send(body)
      .expect(200);
    assert.deepEqual(replay.body, first.body);

    const changedPayload = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({ ...body, description: "Changed after uncertain transport." })
      .expect(409);
    assert.equal(errorCode(changedPayload), "REQUEST_ID_CONFLICT");

    const storedTicket = await activeFixture.prisma.ticket.findUnique({
      select: { version: true },
      where: { id: ticket.id },
    });
    assert.deepEqual(storedTicket, { version: 2 });
    assert.equal(
      await activeFixture.prisma.actionTaken.count({
        where: { ticketId: ticket.id },
      }),
      1
    );
    assert.equal(
      await activeFixture.prisma.actionEvent.count({
        where: { action: { ticketId: ticket.id } },
      }),
      1
    );

    // oxlint-disable no-await-in-loop -- Each replay must observe the preceding status change on the same Ticket.
    for (const currentStatus of ["Resolved", "Closed", "Cancelled"] as const) {
      const beforeReplay = await activeFixture.prisma.ticket.update({
        data: { currentStatus },
        where: { id: ticket.id },
      });
      await request(activeFixture.app)
        .post(`/api/tickets/${ticket.id}/actions`)
        .set(authHeaders(staff))
        .send(body)
        .expect(200);
      assert.deepEqual(
        await activeFixture.prisma.ticket.findUnique({
          where: { id: ticket.id },
        }),
        beforeReplay
      );
    }
    // oxlint-enable no-await-in-loop
  });

  it("replays after assignee ineligibility and keeps request IDs scoped by Ticket and actor", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const body = {
      assigneeId,
      description: "Replay after an eligibility change.",
      followUpRequired: false,
      requestId: "b7726990-c560-45d5-ae76-2f75659bb540",
      version: 1,
    };

    await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send(body)
      .expect(201);
    await activeFixture.prisma.user.update({
      data: { isActive: false },
      where: { id: assigneeId },
    });

    await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send(body)
      .expect(200);
    await activeFixture.prisma.ticket.update({
      data: { currentStatus: "Closed" },
      where: { id: ticket.id },
    });
    await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send(body)
      .expect(200);

    const otherTicket = await createTicket();
    await request(activeFixture.app)
      .post(`/api/tickets/${otherTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({ ...body, assigneeId: staffId, version: 1 })
      .expect(201);

    const actorScopedTicket = await createTicket();
    await request(activeFixture.app)
      .post(`/api/tickets/${actorScopedTicket.id}/actions`)
      .set(authHeaders(staff))
      .send({ ...body, assigneeId: staffId, version: 1 })
      .expect(201);

    const adminScoped = await request(activeFixture.app)
      .post(`/api/tickets/${actorScopedTicket.id}/actions`)
      .set(authHeaders(admin))
      .send({ ...body, assigneeId: staffId, version: 2 })
      .expect(201);
    const adminAction = asJsonObject(asJsonObject(adminScoped.body).action);
    assert.equal(asJsonObject(adminAction.createdBy).id, adminId);
  });

  it("rejects stale and concurrent new creates without partial writes", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const first = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "The first versioned repair.",
        followUpRequired: false,
        requestId: "d6726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(201);
    assert.equal(asJsonObject(first.body).ticket !== undefined, true);

    const stale = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/actions`)
      .set(authHeaders(staff))
      .send({
        description: "A stale repair must not be written.",
        followUpRequired: false,
        requestId: "e6726990-c560-45d5-ae76-2f75659bb540",
        version: 1,
      })
      .expect(409);
    assert.equal(errorCode(stale), "VERSION_CONFLICT");

    const concurrentTicket = await createTicket();
    const responses = await Promise.all(
      [
        "f6726990-c560-45d5-ae76-2f75659bb540",
        "a7726990-c560-45d5-ae76-2f75659bb540",
      ].map(
        async (requestId) =>
          await request(activeFixture.app)
            .post(`/api/tickets/${concurrentTicket.id}/actions`)
            .set(authHeaders(staff))
            .send({
              description: `Concurrent repair ${requestId}.`,
              followUpRequired: false,
              requestId,
              version: 1,
            })
      )
    );
    const responseStatuses = responses.map((response) => response.status);
    // oxlint-disable-next-line no-array-sort
    responseStatuses.sort((left, right) => left - right);
    assert.deepEqual(responseStatuses, [201, 409]);

    const concurrentStored = await activeFixture.prisma.ticket.findUnique({
      select: { version: true },
      where: { id: concurrentTicket.id },
    });
    assert.deepEqual(concurrentStored, { version: 2 });
    assert.equal(
      await activeFixture.prisma.actionTaken.count({
        where: { ticketId: concurrentTicket.id },
      }),
      1
    );
  });
});
