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

const requesterEmail = "action-edit-requester@example.test";
const foreignRequesterEmail = "action-edit-foreign-requester@example.test";
const staffEmail = "action-edit-staff@example.test";
const secondStaffEmail = "action-edit-second-staff@example.test";
const adminEmail = "action-edit-admin@example.test";
const inactiveStaffEmail = "action-edit-inactive-staff@example.test";

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

const getJsonNumber = (value: unknown, field: string): number => {
  const number = asJsonObject(value)[field];

  if (typeof number !== "number") {
    throw new TypeError(`Expected ${field} to be a number.`);
  }

  return number;
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

const waitForActionRowLock = async (
  activeFixture: UsersAdminFixture,
  table: "User" | "Ticket"
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
        AND query LIKE ${`%FROM "${table}"%`}
    `);

    if (Number(rows[0]?.waiters ?? 0) > 0) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Wait until the API transaction requests the row lock.
    await delay(10);
  }

  throw new Error(`The Action Taken edit did not wait for the ${table} lock.`);
};

describe("Lab 4 pending Action Taken edit and history API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
  let foreignRequesterId: number;
  let staffId: number;
  let secondStaffId: number;
  let adminId: number;
  let inactiveStaffId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketSequence = 0;
  let actionSequence = 0;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }

    return fixture;
  };

  const createTicket = async (
    currentStatus: "New" | "Resolved" | "Closed" | "Cancelled" = "New",
    ownerId: number | null = null,
    currentRequesterId = requesterId
  ) => {
    const activeFixture = getFixture();
    ticketSequence += 1;
    const ticketDate = new Date("2026-10-01T04:00:00.000Z");

    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus,
        description: "A pending Action Taken edit API fixture Ticket.",
        itPriority: "Medium",
        ownerId,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId: currentRequesterId,
        statusChangedAt: ticketDate,
        summary: "Pending Action Taken edit fixture",
        ticketDate,
        ticketNumber: `TKT-20261001-ED${ticketSequence.toString().padStart(4, "0")}`,
        updatedAt: ticketDate,
      },
    });
  };

  const createAction = async (
    ticketId: number,
    ticketVersion: number,
    assigneeId = secondStaffId
  ) => {
    const activeFixture = getFixture();
    actionSequence += 1;

    return await request(activeFixture.app)
      .post(`/api/tickets/${ticketId}/actions`)
      .set(authHeaders(staff))
      .send({
        assigneeId,
        description: "Initial action description.",
        followUpRequired: false,
        requestId: `d1847baf-a786-4b25-8d1c-${actionSequence
          .toString()
          .padStart(12, "0")}`,
        result: "Initial result.",
        version: ticketVersion,
      })
      .expect(201);
  };

  const editBody = (
    actionVersion: number,
    ticketVersion: number,
    overrides: Partial<{
      assigneeId: number;
      attachmentNotes: string | null;
      description: string;
      followUpNote: string | null;
      followUpRequired: boolean;
      result: string | null;
    }> = {}
  ) => ({
    actionVersion,
    assigneeId: adminId,
    attachmentNotes: null,
    description: "Replace and test both network ports.",
    followUpNote: null,
    followUpRequired: false,
    result: "Both ports pass the connection test.",
    ticketVersion,
    ...overrides,
  });

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    await activeFixture.reset();
    ticketSequence = 0;
    actionSequence = 0;

    const requesterUser = await activeFixture.createUser({
      displayName: "Edit API Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const foreignRequesterUser = await activeFixture.createUser({
      displayName: "Foreign Edit Requester",
      email: foreignRequesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Edit API Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const secondStaffUser = await activeFixture.createUser({
      displayName: "Second Edit Staff",
      email: secondStaffEmail,
      role: "ITStaff",
    });
    const adminUser = await activeFixture.createUser({
      displayName: "Edit API Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const inactiveStaff = await activeFixture.createUser({
      displayName: "Inactive Edit Staff",
      email: inactiveStaffEmail,
      isActive: false,
      role: "ITStaff",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Action Edit Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Action Edit System" },
    });

    requesterId = requesterUser.id;
    foreignRequesterId = foreignRequesterUser.id;
    staffId = staffUser.id;
    secondStaffId = secondStaffUser.id;
    adminId = adminUser.id;
    inactiveStaffId = inactiveStaff.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("replaces mutable fields, preserves identities, and makes a semantic no-op", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket("New", staffId);
    const created = await createAction(ticket.id, ticket.version);
    const createdBody = asJsonObject(created.body);
    const createdAction = asJsonObject(createdBody.action);
    const actionId = getJsonNumber(createdAction, "id");
    const storedBefore =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    const parentBefore = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });

    const body = editBody(1, 2, {
      attachmentNotes: "  See the existing cable photo.  ",
      description: "  Replace and test both network ports.  ",
      followUpNote: "  Confirm connectivity with the requester.  ",
      followUpRequired: true,
      result: null,
    });
    const response = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(body)
      .expect(200);
    const result = asJsonObject(response.body);
    const updatedAction = asJsonObject(result.action);
    const updatedTicket = asJsonObject(result.ticket);

    assert.equal(
      updatedAction.description,
      "Replace and test both network ports."
    );
    assert.equal(updatedAction.result, null);
    assert.deepEqual(updatedAction.assignee, {
      displayName: "Edit API Administrator",
      id: adminId,
      isActive: true,
      isEligible: true,
      role: "Administrator",
    });
    assert.equal(updatedAction.followUpRequired, true);
    assert.equal(
      updatedAction.followUpNote,
      "Confirm connectivity with the requester."
    );
    assert.equal(
      updatedAction.attachmentNotes,
      "See the existing cable photo."
    );
    assert.equal(updatedAction.status, "Planned");
    assert.equal(updatedAction.version, 2);
    assert.equal(updatedAction.createdAt, createdAction.createdAt);
    assert.deepEqual(updatedAction.createdBy, createdAction.createdBy);
    assert.equal(updatedAction.performedBy, null);
    assert.equal(asJsonObject(updatedTicket.owner).id, staffId);
    assert.equal(updatedTicket.version, 3);

    const storedAfter =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    assert.equal(storedAfter.ticketId, storedBefore.ticketId);
    assert.equal(storedAfter.createdByUserId, storedBefore.createdByUserId);
    assert.equal(
      storedAfter.createdAt.toISOString(),
      storedBefore.createdAt.toISOString()
    );
    assert.equal(storedAfter.performedByUserId, storedBefore.performedByUserId);
    assert.equal(storedAfter.requestId, storedBefore.requestId);
    assert.equal(storedAfter.payloadHash, storedBefore.payloadHash);
    assert.equal(storedAfter.status, storedBefore.status);
    assert.equal(storedAfter.startedAt, storedBefore.startedAt);
    assert.equal(storedAfter.completedAt, storedBefore.completedAt);
    assert.equal(storedAfter.cancelledAt, storedBefore.cancelledAt);

    const eventsBeforeNoOp = await activeFixture.prisma.actionEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { actionId },
    });
    assert.equal(eventsBeforeNoOp.length, 2);
    assert.equal(eventsBeforeNoOp[1]?.eventType, "ActionEdited");
    assert.equal(eventsBeforeNoOp[1]?.actorId, staffId);
    assert.equal(eventsBeforeNoOp[1]?.actionVersion, 2);
    assert.deepEqual(eventsBeforeNoOp[1]?.snapshot, {
      assigneeId: adminId,
      attachmentNotes: "See the existing cable photo.",
      description: "Replace and test both network ports.",
      followUpNote: "Confirm connectivity with the requester.",
      followUpRequired: true,
      result: null,
      status: "Planned",
    });

    const parentAfterEdit = await activeFixture.prisma.ticket.findUniqueOrThrow(
      {
        where: { id: ticket.id },
      }
    );
    assert.equal(parentAfterEdit.ownerId, staffId);
    assert.equal(parentAfterEdit.version, parentBefore.version + 1);
    assert.equal(
      parentAfterEdit.updatedAt.toISOString(),
      storedAfter.updatedAt.toISOString()
    );
    assert.equal(
      eventsBeforeNoOp[1]?.createdAt.toISOString(),
      storedAfter.updatedAt.toISOString()
    );

    const noOp = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(admin))
      .send(
        editBody(2, 3, {
          attachmentNotes: "See the existing cable photo.",
          description: "  Replace and test both network ports.  ",
          followUpNote: "Confirm connectivity with the requester.",
          followUpRequired: true,
          result: "  ",
        })
      )
      .expect(200);
    assert.equal(asJsonObject(asJsonObject(noOp.body).action).version, 2);
    assert.equal(asJsonObject(asJsonObject(noOp.body).ticket).version, 3);
    assert.deepEqual(
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      }),
      storedAfter
    );
    assert.deepEqual(
      await activeFixture.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      }),
      parentAfterEdit
    );
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      2
    );

    const staleNoOp = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(
        editBody(1, 2, {
          assigneeId: adminId,
          attachmentNotes: "See the existing cable photo.",
          description: "Replace and test both network ports.",
          followUpNote: "Confirm connectivity with the requester.",
          followUpRequired: true,
          result: null,
        })
      )
      .expect(409);
    assert.equal(errorCode(staleNoOp), "VERSION_CONFLICT");
    const staleNoOpDetails = asJsonObject(
      asJsonObject(asJsonObject(staleNoOp.body).error).details
    );
    assert.equal(staleNoOpDetails.field, "actionVersion");
  });

  it("requires the strict full replacement body and rejects requester and terminal Ticket writes", async () => {
    const activeFixture = getFixture();

    // oxlint-disable no-await-in-loop -- Each terminal-state case creates and inspects its own database fixture.
    for (const status of ["Resolved", "Closed", "Cancelled"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Each terminal Ticket is checked independently through the API.
      const ticket = await createTicket();
      // oxlint-disable-next-line no-await-in-loop -- Create the pending action before making its parent terminal.
      const created = await createAction(ticket.id, ticket.version);
      const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
      const actionBefore =
        await activeFixture.prisma.actionTaken.findUniqueOrThrow({
          where: { id: actionId },
        });
      await activeFixture.prisma.ticket.update({
        data: { currentStatus: status },
        where: { id: ticket.id },
      });

      const terminal = await request(activeFixture.app)
        .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
        .set(authHeaders(staff))
        .send(editBody(1, 2))
        .expect(409);
      assert.equal(errorCode(terminal), "TICKET_TERMINAL");
      assert.deepEqual(
        await activeFixture.prisma.actionTaken.findUniqueOrThrow({
          where: { id: actionId },
        }),
        actionBefore
      );
      assert.equal(
        await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
        1
      );
    }

    for (const status of ["Completed", "Cancelled"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Terminal actions must reject replacement writes.
      const ticket = await createTicket();
      // oxlint-disable-next-line no-await-in-loop
      const created = await createAction(ticket.id, ticket.version);
      const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
      // oxlint-disable-next-line no-await-in-loop -- Fixture the terminal state without adding a lifecycle transition to this slice.
      await activeFixture.prisma.actionTaken.update({
        data: { status },
        where: { id: actionId },
      });
      const actionBefore =
        await activeFixture.prisma.actionTaken.findUniqueOrThrow({
          where: { id: actionId },
        });

      const terminal = await request(activeFixture.app)
        .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
        .set(authHeaders(staff))
        .send(editBody(1, 2))
        .expect(409);
      assert.equal(errorCode(terminal), "ACTION_TERMINAL");
      assert.deepEqual(
        await activeFixture.prisma.actionTaken.findUniqueOrThrow({
          where: { id: actionId },
        }),
        actionBefore
      );
      assert.equal(
        await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
        1
      );
    }
    // oxlint-enable no-await-in-loop

    const ticket = await createTicket();
    const created = await createAction(ticket.id, ticket.version);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const base = editBody(1, 2);

    const missing = { ...base };
    delete (missing as Partial<typeof missing>).attachmentNotes;
    const missingField = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(missing)
      .expect(400);
    assert.equal(errorCode(missingField), "VALIDATION_ERROR");

    const unsupported = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send({ ...base, createdByUserId: adminId })
      .expect(400);
    assert.equal(errorCode(unsupported), "VALIDATION_ERROR");

    const requesterWrite = await request(activeFixture.app)
      .put(`/api/tickets/2147483647/actions/2147483647`)
      .set(authHeaders(requester))
      .send(base)
      .expect(403);
    assert.equal(errorCode(requesterWrite), "FORBIDDEN");
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );
  });

  it("edits In Progress fields without changing status or performer timestamps", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await createAction(
      ticket.id,
      ticket.version,
      secondStaffId
    );
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const startedAt = new Date();
    await activeFixture.prisma.actionTaken.update({
      data: {
        performedByUserId: secondStaffId,
        startedAt,
        status: "InProgress",
      },
      where: { id: actionId },
    });

    const response = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(admin))
      .send(
        editBody(1, 2, {
          assigneeId: secondStaffId,
          description: "Correct an in-progress repair detail.",
        })
      )
      .expect(200);
    const action = asJsonObject(asJsonObject(response.body).action);
    assert.equal(action.status, "In Progress");
    assert.equal(action.version, 2);
    assert.deepEqual(action.performedBy, {
      displayName: "Second Edit Staff",
      id: secondStaffId,
      role: "IT Staff",
    });
    assert.equal(action.startedAt, startedAt.toISOString());

    const editedEvent = await activeFixture.prisma.actionEvent.findFirstOrThrow(
      {
        orderBy: { actionVersion: "desc" },
        where: { actionId },
      }
    );
    assert.equal(editedEvent.eventType, "ActionEdited");
    assert.equal(editedEvent.fromStatus, "InProgress");
    assert.equal(editedEvent.toStatus, "InProgress");
    assert.deepEqual(editedEvent.snapshot, {
      assigneeId: secondStaffId,
      attachmentNotes: null,
      description: "Correct an in-progress repair detail.",
      followUpNote: null,
      followUpRequired: false,
      result: "Both ports pass the connection test.",
      status: "In Progress",
    });
  });

  it("serializes concurrent edits and reports stale action and Ticket versions without writes", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await createAction(ticket.id, ticket.version);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");

    const concurrent = await Promise.all(
      [
        editBody(1, 2, { description: "Concurrent edit A." }),
        editBody(1, 2, { description: "Concurrent edit B." }),
      ].map(
        async (body) =>
          await request(activeFixture.app)
            .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
            .set(authHeaders(staff))
            .send(body)
      )
    );
    assert.equal(concurrent.filter(({ status }) => status === 200).length, 1);
    assert.equal(concurrent.filter(({ status }) => status === 409).length, 1);
    const conflict = concurrent.find(({ status }) => status === 409);
    assert.ok(conflict);
    assert.equal(errorCode(conflict), "VERSION_CONFLICT");
    assert.equal(
      asJsonObject(asJsonObject(conflict.body).error.details).field,
      "actionVersion"
    );

    const actionAfterRace =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    const ticketAfterRace = await activeFixture.prisma.ticket.findUniqueOrThrow(
      { where: { id: ticket.id } }
    );
    assert.equal(actionAfterRace.version, 2);
    assert.equal(ticketAfterRace.version, 3);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      2
    );

    const staleTicket = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(editBody(2, 2, { description: "Ticket version is stale." }))
      .expect(409);
    assert.equal(errorCode(staleTicket), "VERSION_CONFLICT");
    assert.equal(
      asJsonObject(asJsonObject(staleTicket.body).error.details).field,
      "ticketVersion"
    );

    const staleAction = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(editBody(1, 3, { description: "Action version is stale." }))
      .expect(409);
    assert.equal(errorCode(staleAction), "VERSION_CONFLICT");
    assert.equal(
      asJsonObject(asJsonObject(staleAction.body).error.details).field,
      "actionVersion"
    );
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      2
    );
    const actionAfterStaleWrites =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    const ticketAfterStaleWrites =
      await activeFixture.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
    assert.equal(actionAfterStaleWrites.version, 2);
    assert.equal(ticketAfterStaleWrites.version, 3);
  });

  it("waits for a parent Ticket lock and rejects an edit after concurrent resolution", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await createAction(ticket.id, ticket.version);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    const actionBefore =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    const eventsBefore = await activeFixture.prisma.actionEvent.findMany({
      orderBy: { id: "asc" },
      where: { actionId },
    });
    let releaseTicket!: () => void;
    let markTicketLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the Ticket lock until the edit requests that lock.
    const ticketRelease = new Promise<void>((resolve) => {
      releaseTicket = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal that the test owns the Ticket row lock.
    const ticketLocked = new Promise<void>((resolve) => {
      markTicketLocked = resolve;
    });
    const resolution = activeFixture.prisma.$transaction(async (database) => {
      await database.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticket.id} FOR UPDATE`
      );
      markTicketLocked();
      await ticketRelease;
      const resolvedAt = new Date("2026-10-07T04:00:00.000Z");
      return await database.ticket.update({
        data: {
          currentStatus: "Resolved",
          resolvedAt,
          statusChangedAt: resolvedAt,
          updatedAt: resolvedAt,
          version: { increment: 1 },
        },
        where: { id: ticket.id },
      });
    });
    await ticketLocked;
    const editRequest = request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(editBody(1, 2))
      .then((response) => response);
    let ticketLockError: unknown;
    try {
      await waitForActionRowLock(activeFixture, "Ticket");
    } catch (error: unknown) {
      ticketLockError = error;
    } finally {
      releaseTicket();
    }
    const [response, resolvedTicket] = await Promise.all([
      editRequest,
      resolution,
    ]);
    if (ticketLockError instanceof Error) {
      throw ticketLockError;
    }
    assert.equal(response.status, 409);
    assert.equal(errorCode(response), "VERSION_CONFLICT");
    assert.equal(
      asJsonObject(asJsonObject(response.body).error.details).field,
      "ticketVersion"
    );
    const freshVersionEdit = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(editBody(1, resolvedTicket.version))
      .expect(409);
    assert.equal(errorCode(freshVersionEdit), "TICKET_TERMINAL");
    assert.deepEqual(
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      }),
      actionBefore
    );
    assert.deepEqual(
      await activeFixture.prisma.actionEvent.findMany({
        orderBy: { id: "asc" },
        where: { actionId },
      }),
      eventsBefore
    );
    assert.deepEqual(
      await activeFixture.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      }),
      resolvedTicket
    );
  });

  it("retains historical ineligible assignees but rejects selecting inactive or demoted users", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await createAction(
      ticket.id,
      ticket.version,
      secondStaffId
    );
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    await activeFixture.prisma.user.update({
      data: { role: "Requester" },
      where: { id: secondStaffId },
    });

    const retained = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(
        editBody(1, 2, {
          assigneeId: secondStaffId,
          description: "Correct the pending repair text.",
        })
      )
      .expect(200);
    const retainedAction = asJsonObject(asJsonObject(retained.body).action);
    assert.deepEqual(retainedAction.assignee, {
      displayName: "Second Edit Staff",
      id: secondStaffId,
      isActive: true,
      isEligible: false,
      role: "Requester",
    });

    const nextTicketVersion = getJsonNumber(
      asJsonObject(retained.body).ticket,
      "version"
    );
    const currentTicket = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(currentTicket.version, 3);
    assert.equal(nextTicketVersion, currentTicket.version);

    const secondActionResponse = await createAction(
      ticket.id,
      currentTicket.version,
      staffId
    );
    const secondActionId = getJsonNumber(
      asJsonObject(secondActionResponse.body).action,
      "id"
    );

    const demotedTarget = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${secondActionId}`)
      .set(authHeaders(staff))
      .send(
        editBody(1, currentTicket.version + 1, {
          assigneeId: secondStaffId,
          description: "Cannot newly assign to a demoted user.",
        })
      )
      .expect(409);
    assert.equal(errorCode(demotedTarget), "ACTION_ASSIGNEE_INELIGIBLE");

    const inactiveTarget = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${secondActionId}`)
      .set(authHeaders(staff))
      .send(
        editBody(1, currentTicket.version + 1, {
          assigneeId: inactiveStaffId,
          description: "Cannot newly assign to an inactive user.",
        })
      )
      .expect(409);
    assert.equal(errorCode(inactiveTarget), "ACTION_ASSIGNEE_INELIGIBLE");
    assert.equal(
      await activeFixture.prisma.actionEvent.count({
        where: { action: { ticketId: ticket.id } },
      }),
      3
    );

    await activeFixture.prisma.user.update({
      data: { isActive: false },
      where: { id: staffId },
    });
    const inactiveActor = await request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${secondActionId}`)
      .set(authHeaders(staff))
      .send(editBody(1, currentTicket.version + 1))
      .expect(403);
    assert.equal(errorCode(inactiveActor), "ACCOUNT_INACTIVE");
    assert.equal(
      await activeFixture.prisma.actionEvent.count({
        where: { action: { ticketId: ticket.id } },
      }),
      3
    );
  });

  it("rechecks actor and changed-assignee eligibility after waiting for User locks", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const created = await createAction(
      ticket.id,
      ticket.version,
      secondStaffId
    );
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");

    let releaseAssignee!: () => void;
    let markAssigneeLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the User row lock until the API request is waiting.
    const assigneeRelease = new Promise<void>((resolve) => {
      releaseAssignee = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal when the test owns the target User row lock.
    const assigneeLocked = new Promise<void>((resolve) => {
      markAssigneeLocked = resolve;
    });
    const assigneeDemotion = activeFixture.prisma.$transaction(
      async (database) => {
        await database.$queryRaw(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${adminId} FOR UPDATE`
        );
        await database.user.update({
          data: { role: "Requester" },
          where: { id: adminId },
        });
        markAssigneeLocked();
        await assigneeRelease;
      }
    );

    await assigneeLocked;
    const changedAssigneeRequest = request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(editBody(1, 2, { assigneeId: adminId }))
      .then((response) => response);
    let assigneeLockError: unknown;
    try {
      await waitForActionRowLock(activeFixture, "User");
    } catch (error: unknown) {
      assigneeLockError = error;
    } finally {
      releaseAssignee();
    }
    const changedAssignee = await changedAssigneeRequest;
    await assigneeDemotion;
    if (assigneeLockError instanceof Error) {
      throw assigneeLockError;
    }

    assert.equal(changedAssignee.status, 409);
    assert.equal(errorCode(changedAssignee), "ACTION_ASSIGNEE_INELIGIBLE");
    const actionAfterAssigneeRace =
      await activeFixture.prisma.actionTaken.findUniqueOrThrow({
        where: { id: actionId },
      });
    const ticketAfterAssigneeRace =
      await activeFixture.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
    assert.equal(actionAfterAssigneeRace.version, 1);
    assert.equal(ticketAfterAssigneeRace.version, 2);
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );

    let releaseActor!: () => void;
    let markActorLocked!: () => void;
    // oxlint-disable-next-line promise/avoid-new -- Hold the acting User row lock until the API request is waiting.
    const actorRelease = new Promise<void>((resolve) => {
      releaseActor = resolve;
    });
    // oxlint-disable-next-line promise/avoid-new -- Signal when the test owns the actor User row lock.
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
    const changedActorRequest = request(activeFixture.app)
      .put(`/api/tickets/${ticket.id}/actions/${actionId}`)
      .set(authHeaders(staff))
      .send(editBody(1, 2, { assigneeId: secondStaffId }))
      .then((response) => response);
    let actorLockError: unknown;
    try {
      await waitForActionRowLock(activeFixture, "User");
    } catch (error: unknown) {
      actorLockError = error;
    } finally {
      releaseActor();
    }
    const changedActor = await changedActorRequest;
    await actorDemotion;
    if (actorLockError instanceof Error) {
      throw actorLockError;
    }

    assert.equal(changedActor.status, 403);
    assert.equal(errorCode(changedActor), "FORBIDDEN");
    assert.equal(
      await activeFixture.prisma.actionEvent.count({ where: { actionId } }),
      1
    );
  });

  it("paginates safe ActionEvent history for authorized readers only", async () => {
    const activeFixture = getFixture();
    const ownTicket = await createTicket();
    const created = await createAction(ownTicket.id, ownTicket.version);
    const actionId = getJsonNumber(asJsonObject(created.body).action, "id");
    // API history sizes are restricted to 10, 20 and 50; create enough events
    // to prove deterministic ordering across two real pages.
    // oxlint-disable no-await-in-loop -- Each edit advances both versions for the next request.
    for (let revision = 1; revision <= 10; revision += 1) {
      await request(activeFixture.app)
        .put(`/api/tickets/${ownTicket.id}/actions/${actionId}`)
        .set(authHeaders(staff))
        .send(
          editBody(revision, revision + 1, {
            description: "A safe revision in history.",
            result: `Revision result ${revision}`,
          })
        )
        .expect(200);
    }
    // oxlint-enable no-await-in-loop

    const ownFirst = await request(activeFixture.app)
      .get(
        `/api/tickets/${ownTicket.id}/actions/${actionId}/history?page=1&pageSize=10`
      )
      .set("Cookie", requester.cookie)
      .expect(200);
    const firstBody = asJsonObject(ownFirst.body);
    const firstEvents = asJsonArray(firstBody.items);
    assert.equal(firstBody.totalItems, 11);
    assert.equal(firstBody.totalPages, 2);
    assert.equal(firstEvents.length, 10);
    assert.equal(asJsonObject(firstEvents[0]).eventType, "ActionCreated");
    assert.deepEqual(
      new Set(Object.keys(asJsonObject(firstEvents[0]).actor)),
      new Set(["displayName", "id", "role"])
    );

    const ownSecond = await request(activeFixture.app)
      .get(
        `/api/tickets/${ownTicket.id}/actions/${actionId}/history?page=2&pageSize=10`
      )
      .set("Cookie", requester.cookie)
      .expect(200);
    const secondEvent = asJsonObject(
      asJsonArray(asJsonObject(ownSecond.body).items)[0]
    );
    assert.equal(secondEvent.eventType, "ActionEdited");
    assert.equal(secondEvent.actionVersion, 11);
    assert.equal(secondEvent.fromStatus, "Planned");
    assert.equal(secondEvent.toStatus, "Planned");
    assert.deepEqual(asJsonObject(secondEvent.snapshot), {
      assigneeId: adminId,
      attachmentNotes: null,
      description: "A safe revision in history.",
      followUpNote: null,
      followUpRequired: false,
      result: "Revision result 10",
      status: "Planned",
    });
    assert.deepEqual(
      new Set(Object.keys(secondEvent)),
      new Set([
        "actionId",
        "actionVersion",
        "actor",
        "createdAt",
        "eventType",
        "fromStatus",
        "id",
        "snapshot",
        "toStatus",
      ])
    );
    assert.ok(
      getJsonNumber(secondEvent, "id") > getJsonNumber(firstEvents[0], "id")
    );

    const staffHistory = await request(activeFixture.app)
      .get(`/api/tickets/${ownTicket.id}/actions/${actionId}/history`)
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.equal(asJsonObject(staffHistory.body).pageSize, 20);
    assert.equal(asJsonArray(asJsonObject(staffHistory.body).items).length, 11);
    const adminHistory = await request(activeFixture.app)
      .get(`/api/tickets/${ownTicket.id}/actions/${actionId}/history`)
      .set("Cookie", admin.cookie)
      .expect(200);
    assert.equal(asJsonObject(adminHistory.body).totalItems, 11);

    const emptyPage = await request(activeFixture.app)
      .get(
        `/api/tickets/${ownTicket.id}/actions/${actionId}/history?page=99&pageSize=10`
      )
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.deepEqual(emptyPage.body, {
      items: [],
      page: 99,
      pageSize: 10,
      totalItems: 11,
      totalPages: 2,
    });

    const foreignTicket = await createTicket("New", null, foreignRequesterId);
    const foreignActionResponse = await createAction(
      foreignTicket.id,
      foreignTicket.version
    );
    const foreignActionId = getJsonNumber(
      asJsonObject(foreignActionResponse.body).action,
      "id"
    );
    const foreignRead = await request(activeFixture.app)
      .get(
        `/api/tickets/${foreignTicket.id}/actions/${foreignActionId}/history`
      )
      .set("Cookie", requester.cookie)
      .expect(404);
    assert.equal(errorCode(foreignRead), "RESOURCE_NOT_FOUND");

    const missingAction = await request(activeFixture.app)
      .get(`/api/tickets/${ownTicket.id}/actions/2147483647/history`)
      .set("Cookie", staff.cookie)
      .expect(404);
    assert.equal(errorCode(missingAction), "RESOURCE_NOT_FOUND");

    const wrongParent = await request(activeFixture.app)
      .get(`/api/tickets/${ownTicket.id}/actions/${foreignActionId}/history`)
      .set("Cookie", admin.cookie)
      .expect(404);
    assert.equal(errorCode(wrongParent), "RESOURCE_NOT_FOUND");
  });
});
