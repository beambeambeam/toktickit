import assert from "node:assert/strict";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  removeAttachmentFiles,
  writeAttachmentFile,
} from "../../src/services/attachment-storage.js";
import {
  createUsersAdminFixture,
  TEST_ORIGIN,
} from "../helpers/users-admin-fixture.js";
import type {
  AuthenticatedFixtureSession,
  UsersAdminFixture,
} from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;

const requesterEmail = "queue-requester@example.test";
const otherRequesterEmail = "queue-other-requester@example.test";
const staffEmail = "queue-staff@example.test";
const secondStaffEmail = "queue-second-staff@example.test";
const adminEmail = "queue-admin@example.test";

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

describe("Lab 3 shared Ticket Queue and read-only Ticket access", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let otherRequester: AuthenticatedFixtureSession;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
  let staffId: number;
  let secondStaffId: number;
  let categoryId: number;
  let relatedSystemId: number;
  const storageKeys: string[] = [];

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
    summary?: string;
    ticketNumber: string;
  }) => {
    const activeFixture = getFixture();
    const ticketDate = new Date("2026-09-10T10:00:00.000Z");
    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: input.currentStatus ?? "New",
        description: "A sufficiently long queue fixture description.",
        itPriority: input.itPriority ?? "Low",
        ownerId: input.ownerId ?? null,
        relatedSystemId,
        requestedPriority: input.requestedPriority ?? "Low",
        requesterId,
        statusChangedAt: ticketDate,
        summary: input.summary ?? "Queue fixture ticket",
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
      displayName: "Queue Requester",
      email: requesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Other Queue Requester",
      email: otherRequesterEmail,
      role: "Requester",
    });
    const staffUser = await activeFixture.createUser({
      displayName: "Queue IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    const secondStaffUser = await activeFixture.createUser({
      displayName: "Second Queue IT Staff",
      email: secondStaffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Queue Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    requesterId = requesterUser.id;
    staffId = staffUser.id;
    secondStaffId = secondStaffUser.id;
    const category = await activeFixture.prisma.category.create({
      data: { name: "Queue Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Queue System" },
    });
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    otherRequester = await activeFixture.authenticate(otherRequesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await removeAttachmentFiles(storageKeys);
    await fixture?.teardown();
  });

  it("exposes the shared queue to IT Staff and Administrators only", async () => {
    const activeFixture = getFixture();
    await createTicket({
      itPriority: "Urgent",
      ownerId: staffId,
      requestedPriority: "Low",
      summary: "Urgent operational outage",
      ticketNumber: "TKT-20260910-QUEUE01",
    });

    const staffResponse = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .set("Cookie", staff.cookie)
      .expect(200);
    const staffBody = asJsonObject(staffResponse.body);
    const staffItems = staffBody.items;
    assert.ok(Array.isArray(staffItems));
    assert.equal(staffItems.length, 1);
    const staffItem = asJsonObject(staffItems[0]);
    assert.equal(staffItem.itPriority, "Urgent");
    assert.equal(staffItem.currentStatus, "New");
    assert.equal(asJsonObject(staffItem.owner).displayName, "Queue IT Staff");
    assert.equal(staffItem.version, 1);

    const adminResponse = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .set("Cookie", admin.cookie)
      .expect(200);
    assert.equal(asJsonObject(adminResponse.body).totalItems, 1);

    const requesterResponse = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .set("Cookie", requester.cookie)
      .expect(403);
    assert.equal(errorCode(requesterResponse), "FORBIDDEN");
  });

  it("filters, sorts by business priority, preserves literal search, and paginates", async () => {
    const activeFixture = getFixture();
    const urgentTicket = await createTicket({
      itPriority: "Urgent",
      summary: "Percent % marker",
      ticketNumber: "TKT-20260910-SORT03",
    });
    const lowTicket = await createTicket({
      itPriority: "Low",
      summary: "Percent X marker",
      ticketNumber: "TKT-20260910-SORT01",
    });
    const progressTicket = await createTicket({
      currentStatus: "InProgress",
      itPriority: "High",
      ownerId: secondStaffId,
      summary: "Percent % marker",
      ticketNumber: "TKT-20260910-SORT02",
    });

    const sorted = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ sortBy: "itPriority", sortDirection: "asc" })
      .set("Cookie", staff.cookie)
      .expect(200);
    const sortedItems = asJsonObject(sorted.body).items;
    assert.ok(Array.isArray(sortedItems));
    assert.deepEqual(
      sortedItems.map((item: unknown) => asJsonObject(item).itPriority),
      ["Low", "High", "Urgent"]
    );

    const ticketDateAscending = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ pageSize: 10, sortBy: "ticketDate", sortDirection: "asc" })
      .set("Cookie", staff.cookie)
      .expect(200);
    const ascendingItems = asJsonObject(ticketDateAscending.body).items;
    assert.ok(Array.isArray(ascendingItems));
    assert.deepEqual(
      ascendingItems.map((item: unknown) => asJsonObject(item).id),
      [urgentTicket.id, lowTicket.id, progressTicket.id]
    );

    const ticketDateDescending = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ pageSize: 10, sortBy: "ticketDate", sortDirection: "desc" })
      .set("Cookie", staff.cookie)
      .expect(200);
    const descendingItems = asJsonObject(ticketDateDescending.body).items;
    assert.ok(Array.isArray(descendingItems));
    assert.deepEqual(
      descendingItems.map((item: unknown) => asJsonObject(item).id),
      [progressTicket.id, lowTicket.id, urgentTicket.id]
    );

    const combinedFilters = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({
        categoryId,
        currentStatus: "In Progress",
        itPriority: "High",
        owner: secondStaffId,
        relatedSystemId,
        requestedPriority: "Low",
        search: "Percent %",
      })
      .set("Cookie", staff.cookie)
      .expect(200);
    const combinedBody = asJsonObject(combinedFilters.body);
    assert.equal(combinedBody.totalItems, 1);
    assert.equal(
      asJsonObject(
        Array.isArray(combinedBody.items) ? combinedBody.items[0] : null
      ).ticketNumber,
      "TKT-20260910-SORT02"
    );

    const literalSearch = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ search: "%" })
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.equal(asJsonObject(literalSearch.body).totalItems, 2);

    const ownerSearch = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ owner: "unassigned", page: 1, pageSize: 10 })
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.equal(asJsonObject(ownerSearch.body).totalItems, 2);

    const outOfRange = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ page: 2, pageSize: 20 })
      .set("Cookie", staff.cookie)
      .expect(200);
    assert.equal(asJsonObject(outOfRange.body).totalItems, 3);
    assert.equal(asJsonObject(outOfRange.body).totalPages, 1);
    assert.deepEqual(asJsonObject(outOfRange.body).items, []);
  });

  it("lists eligible owners and rejects strict invalid queue queries", async () => {
    const activeFixture = getFixture();
    const ownersResponse = await request(activeFixture.app)
      .get("/api/staff/owners")
      .set("Cookie", admin.cookie)
      .expect(200);
    const owners = asJsonObject(ownersResponse.body).items;
    assert.ok(Array.isArray(owners));
    assert.deepEqual(
      owners.map((owner: unknown) => asJsonObject(owner).displayName),
      ["Queue Administrator", "Queue IT Staff", "Second Queue IT Staff"]
    );
    assert.equal(asJsonObject(owners[0]).isEligible, true);

    const repeated = await request(activeFixture.app)
      .get(`/api/staff/tickets?page=1&page=1`)
      .set("Cookie", staff.cookie)
      .expect(400);
    assert.equal(errorCode(repeated), "VALIDATION_ERROR");

    const invalidOwner = await request(activeFixture.app)
      .get("/api/staff/tickets")
      .query({ owner: "999999" })
      .set("Cookie", staff.cookie)
      .expect(400);
    assert.equal(errorCode(invalidOwner), "OWNER_INELIGIBLE");
  });

  it("lets all permitted readers open detail and active Attachment content", async () => {
    const activeFixture = getFixture();
    const ticket = await createTicket({
      currentStatus: "InProgress",
      itPriority: "High",
      ownerId: staffId,
      requestedPriority: "Medium",
      ticketNumber: "TKT-20260910-DETAIL01",
    });
    const content = Buffer.from("queue attachment content");
    const storageKey = await writeAttachmentFile(content);
    storageKeys.push(storageKey);
    const attachment = await activeFixture.prisma.attachment.create({
      data: {
        byteSize: content.byteLength,
        mediaType: "application/pdf",
        originalFilename: "queue-evidence.pdf",
        storageKey,
        ticketId: ticket.id,
      },
    });

    await Promise.all(
      [staff, admin, requester].map(async (session) => {
        const detail = await request(activeFixture.app)
          .get(`/api/tickets/${ticket.id}`)
          .set("Cookie", session.cookie)
          .expect(200);
        const body = asJsonObject(detail.body);
        assert.equal(body.currentStatus, "In Progress");
        assert.equal(body.requestedPriority, "Medium");
        assert.equal(body.itPriority, "High");
        assert.equal(asJsonObject(body.owner).displayName, "Queue IT Staff");
        assert.equal(body.version, 1);
        assert.equal(
          asJsonObject(
            Array.isArray(body.attachments) ? body.attachments[0] : null
          ).id,
          attachment.id
        );
      })
    );

    const otherDetail = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}`)
      .set("Cookie", otherRequester.cookie)
      .expect(404);
    assert.equal(errorCode(otherDetail), "RESOURCE_NOT_FOUND");

    const otherAttachments = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/attachments`)
      .set("Cookie", otherRequester.cookie)
      .expect(404);
    assert.equal(errorCode(otherAttachments), "RESOURCE_NOT_FOUND");

    const otherDownload = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/content`)
      .set("Cookie", otherRequester.cookie)
      .expect(404);
    assert.equal(errorCode(otherDownload), "RESOURCE_NOT_FOUND");

    const download = await request(activeFixture.app)
      .get(`/api/tickets/${ticket.id}/attachments/${attachment.id}/content`)
      .set("Cookie", admin.cookie)
      .expect(200);
    assert.deepEqual(download.body, content);
    assert.equal(download.headers["content-type"], "application/pdf");

    const requesterUpload = await request(activeFixture.app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set(authHeaders(staff))
      .expect(403);
    assert.equal(errorCode(requesterUpload), "FORBIDDEN");
  });

  it("copies Requested Priority into IT Priority for authenticated Ticket creation", async () => {
    const activeFixture = getFixture();
    const created = await request(activeFixture.app)
      .post("/api/tickets")
      .set(authHeaders(requester))
      .field("categoryId", categoryId.toString())
      .field("relatedSystemId", relatedSystemId.toString())
      .field("summary", "Created queue priority ticket")
      .field(
        "description",
        "A requester-created Ticket should copy its requested priority."
      )
      .field("requestedPriority", "Urgent")
      .expect(201);
    const ticket = asJsonObject(asJsonObject(created.body).ticket);
    assert.equal(ticket.requestedPriority, "Urgent");
    assert.equal(ticket.itPriority, "Urgent");
    assert.equal(ticket.currentStatus, "New");
    assert.equal(ticket.owner, null);
    assert.equal(ticket.version, 1);
  });
});
