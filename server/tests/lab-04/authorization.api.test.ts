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

const requesterEmail = "authz-requester@example.test";
const staffEmail = "authz-staff@example.test";
const adminEmail = "authz-admin@example.test";

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object.");
  }

  return value;
};

const authHeaders = (session: AuthenticatedFixtureSession) => ({
  Cookie: session.cookie,
  Origin: TEST_ORIGIN,
  "X-CSRF-Token": session.csrfToken,
});

describe("Lab 4 Administrator and Requester authorization API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let administrator: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let administratorId: number;
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
    ownerIdValue = null,
  }: {
    ownerIdValue?: number | null;
  } = {}) => {
    const ticketDate = new Date("2026-09-30T04:00:00.000Z");
    ticketSequence += 1;

    return await getFixture().prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: "New",
        description: "An authorization fixture Ticket with enough detail.",
        itPriority: "Medium",
        ownerId: ownerIdValue,
        relatedSystemId,
        requestedPriority: "Medium",
        requesterId,
        statusChangedAt: ticketDate,
        summary: "Authorization fixture Ticket",
        ticketDate,
        ticketNumber: `TKT-20260930-AUT${ticketSequence.toString().padStart(3, "0")}`,
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
      displayName: "Authz Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Authz Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const administratorUser = await activeFixture.createUser({
      displayName: "Authz Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Authorization Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Authorization System" },
    });

    requesterId = requesterUser.id;
    staffId = staffUser.id;
    administratorId = administratorUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    administrator = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("lets an Administrator claim an unowned Ticket", async () => {
    const ticket = await createTicket();

    const response = await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/claim`)
      .set(authHeaders(administrator))
      .send({ version: ticket.version })
      .expect(200);

    assert.equal(
      asJsonObject(asJsonObject(response.body).owner).id,
      administratorId
    );
  });

  it("lets an Administrator assign the Ticket Owner", async () => {
    const ticket = await createTicket();

    const response = await request(getFixture().app)
      .put(`/api/tickets/${ticket.id}/owner`)
      .set(authHeaders(administrator))
      .send({ ownerId: staffId, version: ticket.version })
      .expect(200);

    assert.equal(asJsonObject(asJsonObject(response.body).owner).id, staffId);
  });

  it("lets an Administrator change the IT Priority", async () => {
    const ticket = await createTicket();

    const response = await request(getFixture().app)
      .patch(`/api/tickets/${ticket.id}/it-priority`)
      .set(authHeaders(administrator))
      .send({ itPriority: "High", version: ticket.version })
      .expect(200);

    assert.equal(asJsonObject(response.body).itPriority, "High");
  });

  it("lets an Administrator move a Ticket to the next status", async () => {
    const ticket = await createTicket({ ownerIdValue: staffId });

    const response = await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(authHeaders(administrator))
      .send({ currentStatus: "Open", version: ticket.version })
      .expect(200);

    assert.equal(asJsonObject(response.body).currentStatus, "Open");
  });

  it("lets an Administrator post a Public Comment", async () => {
    const ticket = await createTicket({ ownerIdValue: staffId });

    const response = await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(authHeaders(administrator))
      .send({ content: "Administrator public update" })
      .expect(201);

    assert.equal(
      asJsonObject(asJsonObject(response.body).comment).content,
      "Administrator public update"
    );
  });

  it("lets an Administrator create an Internal Note", async () => {
    const ticket = await createTicket({ ownerIdValue: staffId });

    const response = await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .set(authHeaders(administrator))
      .send({ content: "Administrator private note" })
      .expect(201);

    assert.equal(
      asJsonObject(asJsonObject(response.body).internalNote).content,
      "Administrator private note"
    );
  });

  it("keeps staff-only Ticket writes away from Requesters", async () => {
    const ticket = await createTicket({ ownerIdValue: staffId });
    const requesterHeaders = authHeaders(requester);

    await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/claim`)
      .set(requesterHeaders)
      .send({ version: ticket.version })
      .expect(403);
    await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/status`)
      .set(requesterHeaders)
      .send({ currentStatus: "Open", version: ticket.version })
      .expect(403);
    await request(getFixture().app)
      .put(`/api/tickets/${ticket.id}/owner`)
      .set(requesterHeaders)
      .send({ ownerId: staffId, version: ticket.version })
      .expect(403);
    await request(getFixture().app)
      .patch(`/api/tickets/${ticket.id}/it-priority`)
      .set(requesterHeaders)
      .send({ itPriority: "High", version: ticket.version })
      .expect(403);
    await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .set(requesterHeaders)
      .send({ content: "Requester must not write notes" })
      .expect(403);
    await request(getFixture().app)
      .get(`/api/tickets/${ticket.id}/internal-notes`)
      .set(requesterHeaders)
      .expect(403);

    await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .set(authHeaders(staff))
      .send({ content: "Staff note" })
      .expect(201);
  });

  it("keeps Requester-only Ticket writes away from Administrators", async () => {
    const ticket = await createTicket({ ownerIdValue: staffId });
    const administratorHeaders = authHeaders(administrator);

    await request(getFixture().app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set(administratorHeaders)
      .send({})
      .expect(403);
    await request(getFixture().app)
      .delete(`/api/tickets/${ticket.id}/attachments/1`)
      .set(administratorHeaders)
      .send({ reason: "Administrator must not remove attachments" })
      .expect(403);
    await request(getFixture().app)
      .put(`/api/tickets/${ticket.id}/resolution-indication`)
      .set(administratorHeaders)
      .send({})
      .expect(403);
  });
});
