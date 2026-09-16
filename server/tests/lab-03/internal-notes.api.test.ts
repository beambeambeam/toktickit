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

const requesterEmail = "notes-requester@example.test";
const otherRequesterEmail = "notes-other-requester@example.test";
const staffEmail = "notes-staff@example.test";
const adminEmail = "notes-admin@example.test";

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

describe("Lab 3 private Ticket Internal Notes", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let otherRequester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
  let categoryId: number;
  let relatedSystemId: number;
  let ticketSequence = 0;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The Internal Note fixture was not initialized.");
    }

    return fixture;
  };

  const createTicket = async (currentStatus = "New" as const) => {
    const activeFixture = getFixture();
    const ticketDate = new Date("2026-09-10T10:00:00.000Z");

    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus,
        description: "A sufficiently long Internal Note fixture description.",
        itPriority: "Low",
        relatedSystemId,
        requestedPriority: "Low",
        requesterId,
        statusChangedAt: ticketDate,
        summary: "Internal Note fixture ticket",
        ticketDate,
        ticketNumber: `TKT-20260910-NOT${String((ticketSequence += 1)).padStart(3, "0")}`,
        updatedAt: ticketDate,
      },
    });
  };

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    ticketSequence = 0;
    await activeFixture.reset();
    const requesterUser = await activeFixture.createUser({
      displayName: "Notes Requester",
      email: requesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Other Notes Requester",
      email: otherRequesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Notes IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Notes Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    requesterId = requesterUser.id;
    const category = await activeFixture.prisma.category.create({
      data: { name: "Internal Notes Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Internal Notes System" },
    });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    otherRequester = await activeFixture.authenticate(otherRequesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("denies Requesters before parsing note resources or revealing existence", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const staffUser = await activeFixture.prisma.user.findUniqueOrThrow({
      where: { email: staffEmail },
    });
    await activeFixture.prisma.internalNote.create({
      data: {
        authorId: staffUser.id,
        content: "Private operational detail",
        ticketId: ticket.id,
      },
    });

    const existingRead = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/internal-notes`)
      .set("Cookie", requester.cookie)
      .expect(403);
    assert.equal(errorCode(existingRead), "FORBIDDEN");

    const missingRead = await request(activeFixture.app)
      .get("/api/tickets/not-an-id/internal-notes")
      .set("Cookie", requester.cookie)
      .expect(403);
    assert.equal(errorCode(missingRead), "FORBIDDEN");

    const missingWrite = await request(activeFixture.app)
      .post("/api/tickets/2147483647/internal-notes")
      .set(authHeaders(requester))
      .send({ content: "Requester must not learn whether this exists." })
      .expect(403);
    assert.equal(errorCode(missingWrite), "FORBIDDEN");
    assert.equal(
      JSON.stringify(existingRead.body).includes("Private operational detail"),
      false
    );
  });

  it("lists deterministic private entries to IT Staff and Administrators only", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const staffUser = await activeFixture.prisma.user.findUniqueOrThrow({
      where: { email: staffEmail },
    });
    const adminUser = await activeFixture.prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
    const firstTime = new Date("2026-09-10T10:01:00.000Z");
    const secondTime = new Date("2026-09-10T10:02:00.000Z");

    await activeFixture.prisma.internalNote.create({
      data: {
        authorId: adminUser.id,
        content: "Second private update",
        createdAt: secondTime,
        ticketId: ticket.id,
      },
    });
    await activeFixture.prisma.internalNote.create({
      data: {
        authorId: staffUser.id,
        content: "First private update",
        createdAt: firstTime,
        ticketId: ticket.id,
      },
    });

    const [staffResponse, adminResponse] = await Promise.all(
      [staff, admin].map(
        async (session) =>
          await request(activeFixture.app)
            .get(`/api/tickets/${ticket.id}/internal-notes`)
            .set("Cookie", session.cookie)
            .expect(200)
      )
    );

    for (const response of [staffResponse, adminResponse]) {
      const { internalNotes } = asJsonObject(response.body);
      assert.ok(Array.isArray(internalNotes));
      assert.deepEqual(
        internalNotes.map((note: unknown) => asJsonObject(note).content),
        ["First private update", "Second private update"]
      );
      assert.deepEqual(
        new Set(Object.keys(asJsonObject(internalNotes[0]))),
        new Set(["author", "content", "createdAt", "id"])
      );
      assert.equal(
        asJsonObject(asJsonObject(internalNotes[0]).author).displayName,
        "Notes IT Staff"
      );
    }

    const requesterTicket = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}`)
      .set("Cookie", requester.cookie)
      .expect(200);
    const requesterTicketText = JSON.stringify(requesterTicket.body);
    assert.equal(requesterTicketText.includes("internalNotes"), false);
    assert.equal(requesterTicketText.includes("First private update"), false);
    assert.equal(requesterTicketText.includes("Second private update"), false);

    const otherRequesterRead = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/internal-notes`)
      .set("Cookie", otherRequester.cookie)
      .expect(403);
    assert.equal(errorCode(otherRequesterRead), "FORBIDDEN");
  });

  it("allows IT Staff to append backend-attributed notes without Ticket mutation", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const before = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });

    const spoofed = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .set(authHeaders(staff))
      .send({
        authorId: 999,
        content: "Private note",
        createdAt: "1999-01-01T00:00:00.000Z",
      })
      .expect(400);
    assert.equal(errorCode(spoofed), "VALIDATION_ERROR");

    const created = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .set(authHeaders(staff))
      .send({ content: "  Staff note\nwith a line break  " })
      .expect(201);
    const { internalNote } = asJsonObject(created.body);
    assert.equal(
      asJsonObject(internalNote).content,
      "Staff note\nwith a line break"
    );
    assert.equal(
      asJsonObject(asJsonObject(internalNote).author).displayName,
      "Notes IT Staff"
    );
    assert.equal(typeof asJsonObject(internalNote).createdAt, "string");

    const after = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(after.currentStatus, "New");
    assert.equal(after.version, before.version);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
    assert.equal(
      await activeFixture.prisma.internalNote.count({
        where: { ticketId: ticket.id },
      }),
      1
    );

    const adminWrite = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/internal-notes`)
      .set(authHeaders(admin))
      .send({ content: "Administrators are read-only." })
      .expect(403);
    assert.equal(errorCode(adminWrite), "FORBIDDEN");
  });

  it("enforces exact content bounds and backend resource errors", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();

    const invalidBodies = [
      {},
      { content: "\t\n " },
      { content: "x".repeat(5001) },
      { content: "valid", visibility: "public" },
    ];
    await Promise.all(
      invalidBodies.map(async (body) => {
        const response = await request(activeFixture.app)
          .post(`/api/tickets/${ticket.id}/internal-notes`)
          .set(authHeaders(staff))
          .send(body)
          .expect(400);
        assert.equal(errorCode(response), "VALIDATION_ERROR");
      })
    );

    const missing = await request(activeFixture.app)
      .post("/api/tickets/2147483647/internal-notes")
      .set(authHeaders(staff))
      .send({ content: "The Ticket does not exist." })
      .expect(404);
    assert.equal(errorCode(missing), "RESOURCE_NOT_FOUND");
    assert.equal(
      await activeFixture.prisma.internalNote.count({
        where: { ticketId: ticket.id },
      }),
      0
    );
  });

  it("counts Unicode code points, reads terminal Tickets, and rejects terminal writes", async () => {
    const activeFixture = getFixture();
    const resolvedTicket = await createTicket("Resolved");
    const resolvedBefore = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: resolvedTicket.id },
    });
    const accepted = await request(activeFixture.app)
      .post(`/api/tickets/${resolvedTicket.id}/internal-notes`)
      .set(authHeaders(staff))
      .send({ content: `${"😀".repeat(5000)} ` })
      .expect(201);
    const acceptedContent = asJsonObject(
      asJsonObject(accepted.body).internalNote
    ).content;
    if (typeof acceptedContent !== "string") {
      throw new TypeError(
        "Expected accepted Internal Note content to be a string."
      );
    }
    assert.equal(
      // oxlint-disable-next-line unicorn/prefer-spread -- Internal Note contract counts Unicode code points.
      Array.from(acceptedContent).length,
      5000
    );
    const resolvedAfter = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: resolvedTicket.id },
    });
    assert.equal(resolvedAfter.version, resolvedBefore.version);
    assert.equal(
      resolvedAfter.updatedAt.getTime(),
      resolvedBefore.updatedAt.getTime()
    );

    await Promise.all(
      (["Closed", "Cancelled"] as const).map(async (status) => {
        const terminalTicket = await createTicket(status);
        const before = await activeFixture.prisma.ticket.findUniqueOrThrow({
          where: { id: terminalTicket.id },
        });
        const response = await request(activeFixture.app)
          .post(`/api/tickets/${terminalTicket.id}/internal-notes`)
          .set(authHeaders(staff))
          .send({ content: "This cannot be added." })
          .expect(409);
        assert.equal(errorCode(response), "TICKET_TERMINAL");
        const after = await activeFixture.prisma.ticket.findUniqueOrThrow({
          where: { id: terminalTicket.id },
        });
        assert.equal(after.version, before.version);
        assert.equal(
          await activeFixture.prisma.internalNote.count({
            where: { ticketId: terminalTicket.id },
          }),
          0
        );
        const read = await request(activeFixture.app)
          .get(`/api/tickets/${terminalTicket.id}/internal-notes`)
          .set("Cookie", staff.cookie)
          .expect(200);
        assert.deepEqual(asJsonObject(read.body).internalNotes, []);
      })
    );
  });
});
