import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Express } from "express";
import { Client, escapeIdentifier } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";

const serverDirectory = fileURLToPath(new URL("../..", import.meta.url));
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalStorageDirectory = process.env.ATTACHMENT_STORAGE_DIR;

if (originalDatabaseUrl === undefined || originalDatabaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required for Lab 2 integration tests");
}

const testDatabaseName = `toktickit_lab2_${randomUUID().replaceAll("-", "")}`;
const adminDatabaseUrl = new URL(originalDatabaseUrl);
adminDatabaseUrl.pathname = "/postgres";
adminDatabaseUrl.searchParams.delete("schema");

const testDatabaseUrl = new URL(originalDatabaseUrl);
testDatabaseUrl.pathname = `/${testDatabaseName}`;
testDatabaseUrl.searchParams.set("schema", "public");
const storageDirectory = path.join(
  tmpdir(),
  `toktickit-attachments-${randomUUID()}`
);

const adminClient = new Client({
  connectionString: adminDatabaseUrl.href,
});
let adminClientConnected = false;
let app: Express;
let prisma: PrismaClient;
let ownerId: number;
let otherRequesterId: number;
let categoryId: number;
let relatedSystemId: number;

const pdf = () => Buffer.from("%PDF-1.7\nLab 2 evidence");

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (response: { text: string }): JsonObject => {
  const value: unknown = JSON.parse(response.text);

  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object response");
  }

  return value;
};

const getJsonObject = (object: JsonObject, key: string): JsonObject => {
  const value = object[key];

  if (!isJsonObject(value)) {
    throw new TypeError(`Expected ${key} to be a JSON object`);
  }

  return value;
};

const getJsonArray = (object: JsonObject, key: string): readonly unknown[] => {
  const value = object[key];

  if (!Array.isArray(value)) {
    throw new TypeError(`Expected ${key} to be a JSON array`);
  }

  return value;
};

const getJsonObjectAt = (
  values: readonly unknown[],
  index: number
): JsonObject => {
  const value = values[index];

  if (!isJsonObject(value)) {
    throw new TypeError(`Expected array item ${index} to be a JSON object`);
  }

  return value;
};

const getJsonNumber = (object: JsonObject, key: string): number => {
  const value = object[key];

  if (typeof value !== "number") {
    throw new TypeError(`Expected ${key} to be a number`);
  }

  return value;
};

const getJsonString = (object: JsonObject, key: string): string => {
  const value = object[key];

  if (typeof value !== "string") {
    throw new TypeError(`Expected ${key} to be a string`);
  }

  return value;
};

const getBinaryBody = (response: { body: unknown }): Buffer => {
  if (!Buffer.isBuffer(response.body)) {
    throw new TypeError("Expected a binary response body");
  }

  return response.body;
};

const createTicket = async (requesterId: number, summary: string) =>
  await request(app)
    .post("/api/tickets")
    .set("X-Development-Requester-Id", requesterId.toString())
    .field("categoryId", categoryId.toString())
    .field("relatedSystemId", relatedSystemId.toString())
    .field("requestedPriority", "High")
    .field("summary", summary)
    .field(
      "description",
      "The requester cannot reach the selected system from the assigned device."
    )
    .expect(201);

const createListTicketRecord = async (input: {
  categoryId: number;
  description: string;
  relatedSystemId: number;
  requestedPriority: "Low" | "Medium" | "High" | "Urgent";
  requesterId: number;
  summary: string;
  ticketDate: Date;
  ticketNumber: string;
  updatedAt: Date;
}) =>
  await prisma.ticket.create({
    data: {
      ...input,
      currentStatus: "New",
    },
  });

beforeAll(async () => {
  await adminClient.connect();
  adminClientConnected = true;
  await adminClient.query(
    `CREATE DATABASE ${escapeIdentifier(testDatabaseName)}`
  );

  process.env.DATABASE_URL = testDatabaseUrl.href;
  process.env.ATTACHMENT_STORAGE_DIR = storageDirectory;
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: serverDirectory,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl.href },
    stdio: "pipe",
  });

  const { app: importedApp } = await import("../../src/app.js");
  const { prisma: importedPrisma } = await import("../../src/db/client.js");
  app = importedApp;
  prisma = importedPrisma;
});

beforeEach(async () => {
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.developmentRequester.deleteMany();
  await prisma.relatedSystem.deleteMany();
  await prisma.category.deleteMany();

  const category = await prisma.category.create({
    data: { displayOrder: 1, name: "Network" },
  });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { displayOrder: 1, name: "Campus Wi-Fi" },
  });
  const owner = await prisma.developmentRequester.create({
    data: {
      displayName: "Ada Requester",
      email: `ada-${randomUUID()}@example.test`,
    },
  });
  const other = await prisma.developmentRequester.create({
    data: {
      displayName: "Ben Requester",
      email: `ben-${randomUUID()}@example.test`,
    },
  });

  categoryId = category.id;
  relatedSystemId = relatedSystem.id;
  ownerId = owner.id;
  otherRequesterId = other.id;
  await mkdir(storageDirectory, { recursive: true });
});

afterAll(async () => {
  try {
    await prisma.$disconnect();
  } finally {
    await rm(storageDirectory, { force: true, recursive: true });
    if (adminClientConnected) {
      try {
        await adminClient.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [testDatabaseName]
        );
      } finally {
        try {
          await adminClient.query(
            `DROP DATABASE IF EXISTS ${escapeIdentifier(testDatabaseName)}`
          );
        } finally {
          await adminClient.end();
        }
      }
    }
    process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalStorageDirectory === undefined) {
      delete process.env.ATTACHMENT_STORAGE_DIR;
    } else {
      process.env.ATTACHMENT_STORAGE_DIR = originalStorageDirectory;
    }
  }
});

describe("Lab 2 requester Ticket API", () => {
  it("returns active reference data and hides inactive Requesters", async () => {
    await prisma.developmentRequester.create({
      data: {
        displayName: "Inactive Requester",
        email: `inactive-${randomUUID()}@example.test`,
        isActive: false,
      },
    });

    const [categories, systems, requesters] = await Promise.all([
      request(app).get("/api/categories").expect(200),
      request(app).get("/api/related-systems").expect(200),
      request(app).get("/api/development-requesters").expect(200),
    ]);

    assert.deepEqual(getJsonArray(parseJson(categories), "items"), [
      { id: categoryId, name: "Network" },
    ]);
    assert.deepEqual(getJsonArray(parseJson(systems), "items"), [
      { id: relatedSystemId, name: "Campus Wi-Fi" },
    ]);
    const requesterItems = getJsonArray(parseJson(requesters), "items");
    assert.equal(requesterItems.length, 2);
    assert.equal(
      requesterItems.some(
        (item) =>
          isJsonObject(item) && item.displayName === "Inactive Requester"
      ),
      false
    );
  });

  it("requires an active requester context and creates an owned Ticket atomically", async () => {
    await request(app)
      .get("/api/tickets")
      .expect(400)
      .expect((response) => {
        const error = getJsonObject(parseJson(response), "error");
        assert.equal(getJsonString(error, "code"), "INVALID_REQUESTER_CONTEXT");
      });

    const response = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", ownerId.toString())
      .field("categoryId", categoryId.toString())
      .field("relatedSystemId", relatedSystemId.toString())
      .field("requestedPriority", "Urgent")
      .field("summary", "  Network outage  ")
      .field(
        "description",
        "  The requester cannot reach the selected system from the assigned device.  "
      )
      .field("requesterId", otherRequesterId.toString())
      .attach("attachments", pdf(), "../evidence.pdf")
      .expect(201);

    const createdTicket = getJsonObject(parseJson(response), "ticket");
    assert.match(
      getJsonString(createdTicket, "ticketNumber"),
      /^TKT-\d{8}-[A-Z0-9]{6}$/u
    );
    assert.equal(
      getJsonNumber(getJsonObject(createdTicket, "requester"), "id"),
      ownerId
    );
    assert.equal(getJsonString(createdTicket, "summary"), "Network outage");
    assert.equal(getJsonString(createdTicket, "currentStatus"), "New");
    assert.equal(
      getJsonString(
        getJsonObjectAt(getJsonArray(createdTicket, "attachments"), 0),
        "originalFilename"
      ),
      "evidence.pdf"
    );
    assert.equal(await prisma.ticket.count(), 1);
    assert.equal(await prisma.attachment.count(), 1);
  });

  it("rejects invalid fields without creating a partial Ticket", async () => {
    await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", ownerId.toString())
      .field("categoryId", categoryId.toString())
      .field("relatedSystemId", relatedSystemId.toString())
      .field("requestedPriority", "Critical")
      .field("summary", "bad")
      .field("description", "short")
      .expect(400)
      .expect((response) => {
        const error = getJsonObject(parseJson(response), "error");
        const details = getJsonObject(error, "details");
        const fields = getJsonObject(details, "fields");
        assert.equal(getJsonString(error, "code"), "VALIDATION_ERROR");
        assert.equal(fields.summary !== undefined, true);
      });

    assert.equal(await prisma.ticket.count(), 0);
  });

  it("lists only owned Tickets and safely hides cross-requester detail", async () => {
    await createTicket(ownerId, "Owned network request");
    const otherTicket = await createTicket(
      otherRequesterId,
      "Other requester request"
    );

    const list = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);

    const listBody = parseJson(list);
    assert.equal(getJsonNumber(listBody, "totalItems"), 1);
    assert.equal(
      getJsonString(
        getJsonObjectAt(getJsonArray(listBody, "items"), 0),
        "summary"
      ),
      "Owned network request"
    );
    assert.equal(getJsonNumber(listBody, "pageSize"), 10);

    const otherTicketBody = getJsonObject(parseJson(otherTicket), "ticket");
    const otherTicketId = getJsonNumber(otherTicketBody, "id");

    await request(app)
      .get(`/api/tickets/${otherTicketId}`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(404);

    await request(app)
      .get("/api/tickets?pageSize=20")
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(400)
      .expect((response) => {
        const error = getJsonObject(parseJson(response), "error");
        assert.equal(getJsonString(error, "code"), "VALIDATION_ERROR");
      });

    const emptyRequester = await prisma.developmentRequester.create({
      data: {
        displayName: "Empty Requester",
        email: `empty-${randomUUID()}@example.test`,
      },
    });
    const emptyList = await request(app)
      .get("/api/tickets")
      .set("X-Development-Requester-Id", emptyRequester.id.toString())
      .expect(200);
    const emptyListBody = parseJson(emptyList);
    assert.deepEqual(getJsonArray(emptyListBody, "items"), []);
    assert.equal(getJsonNumber(emptyListBody, "page"), 1);
    assert.equal(getJsonNumber(emptyListBody, "pageSize"), 10);
    assert.equal(getJsonNumber(emptyListBody, "totalItems"), 0);
    assert.equal(getJsonNumber(emptyListBody, "totalPages"), 0);

    const noResults = await request(app)
      .get("/api/tickets?search=does-not-exist")
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    const noResultsBody = parseJson(noResults);
    assert.deepEqual(getJsonArray(noResultsBody, "items"), []);
    assert.equal(getJsonNumber(noResultsBody, "totalItems"), 0);
    assert.equal(getJsonNumber(noResultsBody, "totalPages"), 0);
  });

  it("supports documented list search, filters, deterministic sorting, and pagination", async () => {
    const secondCategory = await prisma.category.create({
      data: { displayOrder: 2, name: "Hardware" },
    });
    const secondRelatedSystem = await prisma.relatedSystem.create({
      data: { displayOrder: 2, name: "Printer" },
    });
    const fixedTimestamp = new Date("2026-09-02T10:00:00.000Z");
    const records = await Promise.all(
      Array.from(
        { length: 12 },
        async (_, index) =>
          await createListTicketRecord({
            categoryId,
            description: `Description marker ${index + 1}`,
            relatedSystemId,
            requestedPriority: "High",
            requesterId: ownerId,
            summary: "Same summary",
            ticketDate: fixedTimestamp,
            ticketNumber: `TKT-20260902-${(index + 1).toString().padStart(6, "0")}`,
            updatedAt: fixedTimestamp,
          })
      )
    );
    const filteredRecord = await createListTicketRecord({
      categoryId: secondCategory.id,
      description: "Filtered description marker",
      relatedSystemId: secondRelatedSystem.id,
      requestedPriority: "Urgent",
      requesterId: ownerId,
      summary: "Filtered summary",
      ticketDate: fixedTimestamp,
      ticketNumber: "TKT-20260902-FILTER1",
      updatedAt: fixedTimestamp,
    });

    const pageOne = await request(app)
      .get(
        "/api/tickets?page=1&pageSize=10&sortBy=updatedAt&sortDirection=desc"
      )
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    const pageOneBody = parseJson(pageOne);
    const pageOneItems = getJsonArray(pageOneBody, "items");
    assert.equal(getJsonNumber(pageOneBody, "page"), 1);
    assert.equal(getJsonNumber(pageOneBody, "pageSize"), 10);
    assert.equal(getJsonNumber(pageOneBody, "totalItems"), 13);
    assert.equal(getJsonNumber(pageOneBody, "totalPages"), 2);
    assert.equal(pageOneItems.length, 10);

    const pageTwo = await request(app)
      .get(
        "/api/tickets?page=2&pageSize=10&sortBy=updatedAt&sortDirection=desc"
      )
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    const pageTwoBody = parseJson(pageTwo);
    const pageTwoItems = getJsonArray(pageTwoBody, "items");
    assert.equal(getJsonNumber(pageTwoBody, "page"), 2);
    assert.equal(getJsonNumber(pageTwoBody, "pageSize"), 10);
    assert.equal(getJsonNumber(pageTwoBody, "totalItems"), 13);
    assert.equal(getJsonNumber(pageTwoBody, "totalPages"), 2);
    assert.equal(pageTwoItems.length, 3);

    const allRecords = [...records, filteredRecord];
    // oxlint-disable-next-line unicorn/no-array-sort -- expected API ordering is asserted against immutable test records.
    allRecords.sort((left, right) => right.id - left.id);
    const allPageItems = [...pageOneItems, ...pageTwoItems];
    assert.deepEqual(
      allPageItems.map((_, index) =>
        getJsonNumber(getJsonObjectAt(allPageItems, index), "id")
      ),
      allRecords.map(({ id }) => id)
    );

    const ticketNumberSearch = await request(app)
      .get(`/api/tickets?search=${records[0]?.ticketNumber}`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    assert.equal(getJsonNumber(parseJson(ticketNumberSearch), "totalItems"), 1);

    const descriptionSearch = await request(app)
      .get("/api/tickets?search=marker%207")
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    assert.equal(getJsonNumber(parseJson(descriptionSearch), "totalItems"), 1);

    const summarySearch = await request(app)
      .get("/api/tickets?search=Same%20summary")
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    assert.equal(getJsonNumber(parseJson(summarySearch), "totalItems"), 12);

    const filtered = await request(app)
      .get(
        `/api/tickets?categoryId=${secondCategory.id}&relatedSystemId=${secondRelatedSystem.id}&requestedPriority=Urgent&currentStatus=New`
      )
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    const filteredBody = parseJson(filtered);
    assert.equal(getJsonNumber(filteredBody, "totalItems"), 1);
    assert.equal(
      getJsonString(
        getJsonObjectAt(getJsonArray(filteredBody, "items"), 0),
        "ticketNumber"
      ),
      filteredRecord.ticketNumber
    );

    const sameSummaryAscending = await request(app)
      .get(
        `/api/tickets?categoryId=${categoryId}&pageSize=25&sortBy=summary&sortDirection=asc`
      )
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    const sameSummaryItems = getJsonArray(
      parseJson(sameSummaryAscending),
      "items"
    );
    const ascendingRecords = [...records];
    // oxlint-disable-next-line unicorn/no-array-sort -- expected API ordering is asserted against immutable test records.
    ascendingRecords.sort((left, right) => left.id - right.id);
    assert.deepEqual(
      sameSummaryItems.map((_, index) =>
        getJsonNumber(getJsonObjectAt(sameSummaryItems, index), "id")
      ),
      ascendingRecords.map(({ id }) => id)
    );

    for (const invalidQuery of [
      "pageSize=010",
      "pageSize=20",
      "page=1.0",
      "page=1&page=2",
      "sortBy%5Bfield%5D=updatedAt",
      "unsupported=value",
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- each response proves the public validation boundary.
      await request(app)
        .get(`/api/tickets?${invalidQuery}`)
        .set("X-Development-Requester-Id", ownerId.toString())
        .expect(400)
        .expect((response) => {
          const error = getJsonObject(parseJson(response), "error");
          assert.equal(getJsonString(error, "code"), "VALIDATION_ERROR");
        });
    }
  });

  it("supports active download and soft removal without exposing removed content", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", ownerId.toString())
      .field("categoryId", categoryId.toString())
      .field("relatedSystemId", relatedSystemId.toString())
      .field("requestedPriority", "Low")
      .field("summary", "Evidence download test")
      .field(
        "description",
        "The requester needs to verify that an uploaded PDF can be downloaded safely."
      )
      .attach("attachments", pdf(), "evidence.pdf")
      .expect(201);
    const createdBody = getJsonObject(parseJson(created), "ticket");
    const ticketId = getJsonNumber(createdBody, "id");
    const attachmentId = getJsonNumber(
      getJsonObjectAt(getJsonArray(createdBody, "attachments"), 0),
      "id"
    );

    const download = await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${attachmentId}/content`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(200);
    assert.deepEqual(getBinaryBody(download), pdf());

    const removed = await request(app)
      .delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .send({ reason: " No longer needed. " })
      .expect(200);
    const removedAttachment = getJsonObject(parseJson(removed), "attachment");
    assert.equal(getJsonString(removedAttachment, "state"), "Removed");
    assert.equal(
      getJsonString(removedAttachment, "removalReason"),
      "No longer needed."
    );

    await request(app)
      .get(`/api/tickets/${ticketId}/attachments/${attachmentId}/content`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .expect(404);
  });

  it("serializes concurrent Attachment additions at the active limit", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", ownerId.toString())
      .field("categoryId", categoryId.toString())
      .field("relatedSystemId", relatedSystemId.toString())
      .field("requestedPriority", "Medium")
      .field("summary", "Concurrent Attachment limit test")
      .field(
        "description",
        "The Ticket must never exceed five active Attachments during concurrent uploads."
      )
      .attach("attachments", pdf(), "existing-1.pdf")
      .attach("attachments", pdf(), "existing-2.pdf")
      .attach("attachments", pdf(), "existing-3.pdf")
      .attach("attachments", pdf(), "existing-4.pdf")
      .expect(201);
    const ticketId = getJsonNumber(
      getJsonObject(parseJson(created), "ticket"),
      "id"
    );

    const upload = (filename: string) =>
      request(app)
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("X-Development-Requester-Id", ownerId.toString())
        .attach("attachments", pdf(), filename);

    const responses = await Promise.all([
      upload("concurrent-5.pdf"),
      upload("concurrent-6.pdf"),
    ]);

    assert.equal(responses.filter(({ status }) => status === 201).length, 1);
    assert.equal(responses.filter(({ status }) => status === 409).length, 1);
    assert.equal(
      await prisma.attachment.count({
        where: { removedAt: null, ticketId },
      }),
      5
    );
  });

  it("keeps removal retryable when Attachment cleanup fails", async () => {
    const created = await request(app)
      .post("/api/tickets")
      .set("X-Development-Requester-Id", ownerId.toString())
      .field("categoryId", categoryId.toString())
      .field("relatedSystemId", relatedSystemId.toString())
      .field("requestedPriority", "Low")
      .field("summary", "Attachment cleanup retry test")
      .field(
        "description",
        "A storage cleanup failure must leave the Attachment available for a later retry."
      )
      .attach("attachments", pdf(), "retryable.pdf")
      .expect(201);
    const createdBody = getJsonObject(parseJson(created), "ticket");
    const ticketId = getJsonNumber(createdBody, "id");
    const attachmentId = getJsonNumber(
      getJsonObjectAt(getJsonArray(createdBody, "attachments"), 0),
      "id"
    );
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (attachment === null) {
      throw new Error("Expected the test Attachment to exist.");
    }

    const attachmentPath = path.join(storageDirectory, attachment.storageKey);
    await rm(attachmentPath);
    await mkdir(attachmentPath);

    const failedRemoval = await request(app)
      .delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .send({ reason: "Retry after storage failure" })
      .expect(500);
    assert.equal(
      getJsonString(getJsonObject(parseJson(failedRemoval), "error"), "code"),
      "ATTACHMENT_CLEANUP_FAILURE"
    );

    const afterFailure = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    assert.notEqual(afterFailure, null);
    assert.equal(afterFailure?.removedAt, null);
    assert.equal(afterFailure?.removalReason, null);

    await rm(attachmentPath, { force: true, recursive: true });
    await writeFile(attachmentPath, pdf());

    const removed = await request(app)
      .delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`)
      .set("X-Development-Requester-Id", ownerId.toString())
      .send({ reason: "Retry after storage failure" })
      .expect(200);
    assert.equal(
      getJsonString(getJsonObject(parseJson(removed), "attachment"), "state"),
      "Removed"
    );
  });
});
