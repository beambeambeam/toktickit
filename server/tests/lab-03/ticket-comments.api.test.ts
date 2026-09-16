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

const requesterEmail = "comments-requester@example.test";
const otherRequesterEmail = "comments-other-requester@example.test";
const staffEmail = "comments-staff@example.test";
const adminEmail = "comments-admin@example.test";

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

describe("Lab 3 public Ticket comments", () => {
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
      throw new Error("The public-comment fixture was not initialized.");
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
        description: "A sufficiently long public-comment fixture description.",
        itPriority: "Low",
        relatedSystemId,
        requestedPriority: "Low",
        requesterId,
        statusChangedAt: ticketDate,
        summary: "Public comment fixture ticket",
        ticketDate,
        ticketNumber: `TKT-20260910-COM${String((ticketSequence += 1)).padStart(3, "0")}`,
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
      displayName: "Comments Requester",
      email: requesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Other Comments Requester",
      email: otherRequesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Comments IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Comments Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    requesterId = requesterUser.id;
    const category = await activeFixture.prisma.category.create({
      data: { name: "Comments Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Comments System" },
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

  it("lists ordered comments to permitted readers and hides foreign Tickets", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const staffUser = await activeFixture.prisma.user.findUniqueOrThrow({
      where: { email: staffEmail },
    });
    const firstTime = new Date("2026-09-10T10:01:00.000Z");
    const secondTime = new Date("2026-09-10T10:02:00.000Z");

    await activeFixture.prisma.publicComment.create({
      data: {
        authorId: staffUser.id,
        content: "Second update",
        createdAt: secondTime,
        ticketId: ticket.id,
      },
    });
    await activeFixture.prisma.publicComment.create({
      data: {
        authorId: requesterId,
        content: "First update",
        createdAt: firstTime,
        ticketId: ticket.id,
      },
    });

    await Promise.all(
      [requester, staff, admin].map(async (session) => {
        const response = await request(activeFixture.app)
          .get(`/api/tickets/${ticket.id}/comments`)
          .set("Cookie", session.cookie)
          .expect(200);
        const { comments } = asJsonObject(response.body);
        assert.ok(Array.isArray(comments));
        assert.deepEqual(
          comments.map((comment: unknown) => asJsonObject(comment).content),
          ["First update", "Second update"]
        );
        assert.deepEqual(
          new Set(Object.keys(asJsonObject(comments[0]))),
          new Set(["author", "content", "createdAt", "id"])
        );
        assert.equal(
          asJsonObject(asJsonObject(comments[0]).author).displayName,
          "Comments Requester"
        );
      })
    );

    const foreign = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/comments`)
      .set("Cookie", otherRequester.cookie)
      .expect(404);
    assert.equal(errorCode(foreign), "RESOURCE_NOT_FOUND");
  });

  it("allows owned Requester and any IT Staff posts with backend attribution", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();
    const before = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });

    const requesterResponse = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(authHeaders(requester))
      .send({
        authorId: 999,
        content: "  Requester update\nwith a line break  ",
        createdAt: "1999-01-01T00:00:00.000Z",
      })
      .expect(400);
    assert.equal(errorCode(requesterResponse), "VALIDATION_ERROR");

    const validRequesterResponse = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(authHeaders(requester))
      .send({ content: "  Requester update\nwith a line break  " })
      .expect(201);
    const requesterComment = asJsonObject(validRequesterResponse.body).comment;
    assert.equal(
      asJsonObject(requesterComment).content,
      "Requester update\nwith a line break"
    );
    assert.equal(
      asJsonObject(asJsonObject(requesterComment).author).displayName,
      "Comments Requester"
    );

    const staffResponse = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(authHeaders(staff))
      .send({ content: "Staff update" })
      .expect(201);
    assert.equal(
      asJsonObject(asJsonObject(staffResponse.body).comment).content,
      "Staff update"
    );

    const after = await activeFixture.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    assert.equal(after.currentStatus, "New");
    assert.equal(after.version, before.version + 2);
    assert.ok(after.updatedAt > before.updatedAt);
    assert.equal(
      await activeFixture.prisma.publicComment.count({
        where: { ticketId: ticket.id },
      }),
      2
    );
  });

  it("rejects Administrator, foreign Requester, and malformed writes", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket();

    const adminResponse = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(authHeaders(admin))
      .send({ content: "Administrator must be read-only." })
      .expect(403);
    assert.equal(errorCode(adminResponse), "FORBIDDEN");

    const foreignResponse = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(authHeaders(otherRequester))
      .send({ content: "Foreign Ticket content" })
      .expect(404);
    assert.equal(errorCode(foreignResponse), "RESOURCE_NOT_FOUND");

    await Promise.all(
      [
        {},
        { content: "\t\n " },
        { content: "x".repeat(5001) },
        { content: "valid", visibility: "private" },
      ].map(async (body) => {
        const response = await request(activeFixture.app)
          .post(`/api/tickets/${ticket.id}/comments`)
          .set(authHeaders(requester))
          .send(body)
          .expect(400);
        assert.equal(errorCode(response), "VALIDATION_ERROR");
      })
    );

    assert.equal(
      await activeFixture.prisma.publicComment.count({
        where: { ticketId: ticket.id },
      }),
      0
    );
  });

  it("counts Unicode code points, accepts Resolved, and rejects Closed or Cancelled writes", async () => {
    const activeFixture = getFixture();
    const resolvedTicket = await createTicket("Resolved");
    const accepted = await request(activeFixture.app)
      .post(`/api/tickets/${resolvedTicket.id}/comments`)
      .set(authHeaders(requester))
      .send({ content: `${"😀".repeat(5000)} ` })
      .expect(201);
    const acceptedContent = asJsonObject(
      asJsonObject(accepted.body).comment
    ).content;
    if (typeof acceptedContent !== "string") {
      throw new TypeError("Expected the accepted content to be a string.");
    }
    assert.equal(
      // oxlint-disable-next-line unicorn/prefer-spread -- comment contract counts Unicode code points.
      Array.from(acceptedContent).length,
      5000
    );

    await Promise.all(
      (["Closed", "Cancelled"] as const).map(async (status) => {
        const terminalTicket = await createTicket(status);
        const before = await activeFixture.prisma.ticket.findUniqueOrThrow({
          where: { id: terminalTicket.id },
        });
        const response = await request(activeFixture.app)
          .post(`/api/tickets/${terminalTicket.id}/comments`)
          .set(authHeaders(requester))
          .send({ content: "This must not be accepted." })
          .expect(409);
        assert.equal(errorCode(response), "TICKET_TERMINAL");
        const after = await activeFixture.prisma.ticket.findUniqueOrThrow({
          where: { id: terminalTicket.id },
        });
        assert.equal(after.version, before.version);
        assert.equal(
          await activeFixture.prisma.publicComment.count({
            where: { ticketId: terminalTicket.id },
          }),
          0
        );
      })
    );
  });
});
