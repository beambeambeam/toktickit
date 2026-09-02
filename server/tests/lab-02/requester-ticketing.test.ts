import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
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
});
