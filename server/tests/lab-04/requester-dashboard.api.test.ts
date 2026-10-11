import assert from "node:assert/strict";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { findRequesterDashboard } from "../../src/repositories/requester-dashboard.js";
import {
  createUsersAdminFixture,
  TEST_ORIGIN,
} from "../helpers/users-admin-fixture.js";
import type {
  AuthenticatedFixtureSession,
  UsersAdminFixture,
} from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;
type TicketStatus =
  | "New"
  | "Open"
  | "InProgress"
  | "WaitingForRequester"
  | "Resolved"
  | "Closed"
  | "Reopened"
  | "Cancelled";

const requesterEmail = "dashboard-requester@example.test";
const foreignRequesterEmail = "dashboard-foreign@example.test";
const staffEmail = "dashboard-staff@example.test";
const adminEmail = "dashboard-admin@example.test";
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

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

const getArrayItem = (items: JsonObject[], index: number): JsonObject => {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Expected a JSON item at index ${index}.`);
  }
  return item;
};

const getTicketId = (
  tickets: readonly { id: number }[],
  index: number
): number => {
  const ticket = tickets[index];
  if (ticket === undefined) {
    throw new RangeError(`Expected a Ticket at index ${index}.`);
  }
  return ticket.id;
};

const getNumber = (object: JsonObject, field: string): number => {
  const value = object[field];
  if (typeof value !== "number") {
    throw new TypeError(`Expected ${field} to be a number.`);
  }
  return value;
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

describe("Lab 4 Requester dashboard API", () => {
  let fixture: UsersAdminFixture | undefined;
  let requester: AuthenticatedFixtureSession;
  let foreignRequesterId: number;
  let staff: AuthenticatedFixtureSession;
  let admin: AuthenticatedFixtureSession;
  let requesterId: number;
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
    input: {
      currentStatus?: TicketStatus;
      requesterId?: number;
      resolvedAt?: Date | null;
      summary?: string;
      updatedAt?: Date;
    } = {}
  ) => {
    const activeFixture = getFixture();
    ticketSequence += 1;
    const ticketDate = new Date(Date.now() - 10 * sevenDaysMs);
    return await activeFixture.prisma.ticket.create({
      data: {
        categoryId,
        currentStatus: input.currentStatus ?? "New",
        description: "A dashboard fixture Ticket with enough detail to read.",
        itPriority: "Medium",
        relatedSystemId,
        requestedPriority: "High",
        requesterId: input.requesterId ?? requesterId,
        resolvedAt: input.resolvedAt ?? null,
        statusChangedAt: ticketDate,
        summary:
          input.summary ?? `Requester dashboard Ticket ${ticketSequence}`,
        ticketDate,
        ticketNumber: `TKT-20261011-DASH${ticketSequence.toString().padStart(3, "0")}`,
        updatedAt: input.updatedAt ?? new Date(Date.now() - 60_000),
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
      displayName: "Dashboard Requester",
      email: requesterEmail,
      role: "Requester",
    });
    const foreignUser = await activeFixture.createUser({
      displayName: "Foreign Dashboard Requester",
      email: foreignRequesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Dashboard IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
    await activeFixture.createUser({
      displayName: "Dashboard Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Dashboard Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Dashboard System" },
    });

    requesterId = requesterUser.id;
    foreignRequesterId = foreignUser.id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
    requester = await activeFixture.authenticate(requesterEmail);
    staff = await activeFixture.authenticate(staffEmail);
    admin = await activeFixture.authenticate(adminEmail);
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("returns only own public Ticket metrics and bounded previews from one UTC window", async () => {
    const activeFixture = getFixture();
    const recentStatuses: TicketStatus[] = [
      "New",
      "Open",
      "InProgress",
      "WaitingForRequester",
      "Reopened",
      "New",
    ];
    const recentTickets: { id: number }[] = [];
    for (const [index, status] of recentStatuses.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- Stable creation order proves preview sorting and ties.
      const ticket = await createTicket({
        currentStatus: status,
        summary: `Own recent Ticket ${index + 1}`,
        updatedAt: new Date(Date.now() - index * 60_000),
      });
      recentTickets.push(ticket);
    }
    await createTicket({
      currentStatus: "Reopened",
      summary: "Own active Ticket outside the recent window",
      updatedAt: new Date(Date.now() - sevenDaysMs - 60_000),
    });
    const recentCancelled = await createTicket({
      currentStatus: "Cancelled",
      summary: "Own recently updated cancelled Ticket",
      updatedAt: new Date(Date.now() - 30_000),
    });
    const recentResolved = await createTicket({
      currentStatus: "Resolved",
      resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      summary: "Own recently resolved Ticket",
      updatedAt: new Date(Date.now() - sevenDaysMs - 60_000),
    });
    const recentClosed = await createTicket({
      currentStatus: "Closed",
      resolvedAt: new Date(Date.now() - 60 * 60 * 1000),
      summary: "Own recently closed Ticket",
      updatedAt: new Date(Date.now() - sevenDaysMs - 60_000),
    });
    await createTicket({
      currentStatus: "Closed",
      resolvedAt: new Date(Date.now() - sevenDaysMs - 60_000),
      summary: "Own older resolved Ticket",
      updatedAt: new Date(Date.now() - sevenDaysMs - 60_000),
    });
    await createTicket({
      currentStatus: "New",
      requesterId: foreignRequesterId,
      summary: "Foreign recent Ticket must stay private",
      updatedAt: new Date(Date.now() - 10_000),
    });
    await createTicket({
      currentStatus: "Resolved",
      requesterId: foreignRequesterId,
      resolvedAt: new Date(Date.now() - 60_000),
      summary: "Foreign resolved Ticket must stay private",
      updatedAt: new Date(Date.now() - sevenDaysMs - 60_000),
    });
    await createTicket({
      currentStatus: "WaitingForRequester",
      requesterId: foreignRequesterId,
      summary: "Foreign waiting Ticket must stay private",
      updatedAt: new Date(Date.now() - 20_000),
    });
    await activeFixture.prisma.internalNote.create({
      data: {
        authorId: requesterId,
        content: "PRIVATE_NOTE_SENTINEL_dashboard_only",
        ticketId: getTicketId(recentTickets, 0),
      },
    });

    const response = await request(activeFixture.app)
      .get("/api/requester/dashboard")
      .set(authHeaders(requester))
      .expect(200);
    const dashboard = asJsonObject(response.body);
    const generatedAt = new Date(getString(dashboard, "generatedAt"));
    const window = asJsonObject(dashboard.window);
    assert.equal(getString(window, "through"), generatedAt.toISOString());
    assert.equal(
      getString(window, "from"),
      new Date(generatedAt.getTime() - sevenDaysMs).toISOString()
    );
    assert.deepEqual(asJsonObject(dashboard.counts), {
      activeTickets: 7,
      recentlyResolved: 2,
      recentlyUpdated: 7,
      waitingForRequester: 1,
    });

    const previews = asJsonObject(dashboard.previews);
    const updatedPreviews = asJsonArray(previews.recentlyUpdated);
    const resolvedPreviews = asJsonArray(previews.recentlyResolved);
    assert.equal(updatedPreviews.length, 5);
    assert.equal(
      getArrayItem(updatedPreviews, 0).id,
      getTicketId(recentTickets, 0)
    );
    assert.equal(
      getArrayItem(updatedPreviews, 4).id,
      getTicketId(recentTickets, 3)
    );
    assert.ok(
      updatedPreviews.some((ticket) => ticket.id === recentCancelled.id)
    );
    assert.equal(resolvedPreviews.length, 2);
    assert.equal(getArrayItem(resolvedPreviews, 0).id, recentClosed.id);
    assert.equal(getArrayItem(resolvedPreviews, 0).currentStatus, "Closed");
    assert.equal(getArrayItem(resolvedPreviews, 1).id, recentResolved.id);
    assert.deepEqual(
      new Set(Object.keys(getArrayItem(updatedPreviews, 0))),
      new Set([
        "currentStatus",
        "id",
        "requestedPriority",
        "resolvedAt",
        "summary",
        "ticketNumber",
        "updatedAt",
      ])
    );
    assert.ok(!JSON.stringify(dashboard).includes("PRIVATE_NOTE_SENTINEL"));
    assert.ok(!JSON.stringify(dashboard).includes("Foreign recent Ticket"));
    assert.ok(!JSON.stringify(dashboard).includes("Foreign resolved Ticket"));
    assert.ok(!JSON.stringify(dashboard).includes("Foreign waiting Ticket"));
    assert.ok(!JSON.stringify(dashboard).includes("internalNotes"));

    const activeList = await request(activeFixture.app)
      .get("/api/tickets")
      .query({ pageSize: 50, scope: "active" })
      .set(authHeaders(requester))
      .expect(200);
    assert.equal(getNumber(asJsonObject(activeList.body), "totalItems"), 7);
    const waitingList = await request(activeFixture.app)
      .get("/api/tickets")
      .query({ pageSize: 50, scope: "waiting-for-requester" })
      .set(authHeaders(requester))
      .expect(200);
    assert.equal(getNumber(asJsonObject(waitingList.body), "totalItems"), 1);
    const updatedList = await request(activeFixture.app)
      .get("/api/tickets")
      .query({
        from: getString(window, "from"),
        pageSize: 50,
        scope: "recently-updated",
        through: getString(window, "through"),
      })
      .set(authHeaders(requester))
      .expect(200);
    assert.equal(getNumber(asJsonObject(updatedList.body), "totalItems"), 7);
    const resolvedList = await request(activeFixture.app)
      .get("/api/tickets")
      .query({
        from: getString(window, "from"),
        pageSize: 50,
        scope: "recently-resolved",
        through: getString(window, "through"),
      })
      .set(authHeaders(requester))
      .expect(200);
    assert.equal(getNumber(asJsonObject(resolvedList.body), "totalItems"), 2);
    const resolvedItems = asJsonArray(asJsonObject(resolvedList.body).items);
    assert.deepEqual(
      resolvedItems.map((ticket) => ticket.id),
      [recentClosed.id, recentResolved.id]
    );
  });

  it("includes rows exactly at both window endpoints and excludes rows 1 ms outside", async () => {
    const activeFixture = getFixture();
    const through = new Date("2026-10-11T04:00:00.000Z");
    const from = new Date(through.getTime() - sevenDaysMs);
    const offsets = [
      ["before from", from.getTime() - 1, false],
      ["at from", from.getTime(), true],
      ["inside", from.getTime() + 1, true],
      ["at through", through.getTime(), true],
      ["after through", through.getTime() + 1, false],
    ] as const;
    const updatedIds = new Map<string, number>();
    const resolvedIds = new Map<string, number>();
    for (const [label, time] of offsets) {
      const instant = new Date(time);
      // oxlint-disable-next-line no-await-in-loop -- Stable creation order keeps IDs predictable.
      const updated = await createTicket({
        summary: `Updated ${label}`,
        updatedAt: instant,
      });
      updatedIds.set(label, updated.id);
      // oxlint-disable-next-line no-await-in-loop -- Stable creation order keeps IDs predictable.
      const resolved = await createTicket({
        currentStatus: "Resolved",
        resolvedAt: instant,
        summary: `Resolved ${label}`,
        updatedAt: new Date(from.getTime() - 60_000),
      });
      resolvedIds.set(label, resolved.id);
    }
    const expectedLabels = offsets
      .filter((offset) => offset[2])
      .map((offset) => offset[0]);

    const dashboard = await findRequesterDashboard(requesterId, through);
    assert.equal(dashboard.window.from.toISOString(), from.toISOString());
    assert.equal(dashboard.window.through.toISOString(), through.toISOString());
    assert.equal(dashboard.counts.recentlyUpdated, expectedLabels.length);
    assert.equal(dashboard.counts.recentlyResolved, expectedLabels.length);

    for (const [scope, ids] of [
      ["recently-updated", updatedIds],
      ["recently-resolved", resolvedIds],
    ] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Each scope is checked on its own.
      const response = await request(activeFixture.app)
        .get("/api/tickets")
        .query({
          from: from.toISOString(),
          pageSize: 50,
          scope,
          through: through.toISOString(),
        })
        .set(authHeaders(requester))
        .expect(200);
      const items = asJsonArray(asJsonObject(response.body).items);
      assert.deepEqual(
        new Set(items.map((ticket) => ticket.id)),
        new Set(expectedLabels.map((label) => ids.get(label))),
        `${scope} keeps both endpoints and drops 1 ms outside`
      );
    }
  });

  it("returns truthful empty metrics and previews for a requester with no Tickets", async () => {
    const response = await request(getFixture().app)
      .get("/api/requester/dashboard")
      .set(authHeaders(requester))
      .expect(200);
    const dashboard = asJsonObject(response.body);

    assert.deepEqual(asJsonObject(dashboard.counts), {
      activeTickets: 0,
      recentlyResolved: 0,
      recentlyUpdated: 0,
      waitingForRequester: 0,
    });
    assert.deepEqual(asJsonObject(dashboard.previews), {
      recentlyResolved: [],
      recentlyUpdated: [],
    });
  });

  it("keeps dashboard previews and recent Ticket pages bounded for larger data", async () => {
    const activeFixture = getFixture();
    const now = new Date();
    const rows = Array.from({ length: 120 }, (_, index) => {
      const isResolved = index >= 100;
      const updatedAt = new Date(now.getTime() - index * 1000);
      return {
        categoryId,
        currentStatus: isResolved ? ("Resolved" as const) : ("New" as const),
        description: "A bounded dashboard performance fixture Ticket.",
        itPriority: "Medium" as const,
        relatedSystemId,
        requestedPriority: "High" as const,
        requesterId,
        resolvedAt: isResolved ? updatedAt : null,
        statusChangedAt: updatedAt,
        summary: `Requester dashboard performance fixture ${index + 1}`,
        ticketDate: new Date(now.getTime() - 30 * sevenDaysMs),
        ticketNumber: `TKT-20261011-P${index.toString().padStart(5, "0")}`,
        updatedAt,
      };
    });
    await activeFixture.prisma.ticket.createMany({ data: rows });

    const dashboardStartedAt = performance.now();
    const dashboardResponse = await request(activeFixture.app)
      .get("/api/requester/dashboard")
      .set(authHeaders(requester))
      .expect(200);
    const dashboardDurationMs = Math.round(
      performance.now() - dashboardStartedAt
    );
    const dashboardBytes = Buffer.byteLength(
      JSON.stringify(dashboardResponse.body)
    );
    const dashboard = asJsonObject(dashboardResponse.body);
    const counts = asJsonObject(dashboard.counts);
    const previews = asJsonObject(dashboard.previews);
    assert.equal(getNumber(counts, "activeTickets"), 100);
    assert.equal(getNumber(counts, "recentlyUpdated"), 120);
    assert.equal(getNumber(counts, "recentlyResolved"), 20);
    assert.equal(asJsonArray(previews.recentlyUpdated).length, 5);
    assert.equal(asJsonArray(previews.recentlyResolved).length, 5);
    assert.ok(dashboardBytes < 20_000);

    const window = asJsonObject(dashboard.window);
    const listMeasurements: {
      durationMs: number;
      responseBytes: number;
      scope: string;
    }[] = [];
    for (const scope of ["recently-updated", "recently-resolved"] as const) {
      const startedAt = performance.now();
      // oxlint-disable-next-line no-await-in-loop -- Keep scope measurements separate and ordered.
      const response = await request(activeFixture.app)
        .get("/api/tickets")
        .query({
          from: getString(window, "from"),
          page: 1,
          pageSize: 10,
          scope,
          through: getString(window, "through"),
        })
        .set(authHeaders(requester))
        .expect(200);
      const durationMs = Math.round(performance.now() - startedAt);
      const responseBytes = Buffer.byteLength(JSON.stringify(response.body));
      const list = asJsonObject(response.body);
      assert.equal(
        getNumber(list, "totalItems"),
        scope === "recently-updated" ? 120 : 20
      );
      assert.equal(asJsonArray(list.items).length, 10);
      assert.ok(responseBytes < 40_000);
      listMeasurements.push({ durationMs, responseBytes, scope });
    }

    console.info(
      `PERF-01 local smoke: dashboard ${dashboardDurationMs}ms/${dashboardBytes}B; ${listMeasurements.map(({ durationMs, responseBytes, scope }) => `${scope} ${durationMs}ms/${responseBytes}B`).join(", ")}`
    );
  });

  it("enforces requester role, authentication, and strict query scope", async () => {
    const { app } = getFixture();
    const unauthenticated = await request(app)
      .get("/api/requester/dashboard")
      .expect(401);
    assert.equal(errorCode(unauthenticated), "AUTHENTICATION_REQUIRED");

    const staffResponse = await request(app)
      .get("/api/requester/dashboard")
      .set(authHeaders(staff))
      .expect(403);
    assert.equal(errorCode(staffResponse), "FORBIDDEN");
    const adminResponse = await request(app)
      .get("/api/requester/dashboard")
      .set(authHeaders(admin))
      .expect(403);
    assert.equal(errorCode(adminResponse), "FORBIDDEN");

    const foreignScope = await request(app)
      .get(`/api/requester/dashboard?requesterId=${foreignRequesterId}`)
      .set(authHeaders(requester))
      .expect(400);
    assert.equal(errorCode(foreignScope), "VALIDATION_ERROR");
    const forgedListScope = await request(app)
      .get(`/api/tickets?requesterId=${foreignRequesterId}`)
      .set(authHeaders(requester))
      .expect(400);
    assert.equal(errorCode(forgedListScope), "VALIDATION_ERROR");

    for (const query of [
      "scope=recently-updated",
      "scope=recently-resolved&from=2026-10-04T04:00:00Z",
      "scope=recently-updated&from=2026-10-04T04:00:00%2B07:00&through=2026-10-11T04:00:00Z",
      "scope=active&from=2026-10-04T04:00:00Z&through=2026-10-11T04:00:00Z",
      "scope=unsupported",
      "scope=recently-updated&from=2026-10-11T04:00:00Z&through=2026-10-04T04:00:00Z",
      "scope=active&scope=recently-updated",
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- Each invalid shape must return the public validation envelope.
      const invalid = await request(app)
        .get(`/api/tickets?${query}`)
        .set(authHeaders(requester))
        .expect(400);
      assert.equal(errorCode(invalid), "VALIDATION_ERROR");
    }
  });
});
