import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import argon2 from "argon2";
import type { Express } from "express";
import { Client, escapeIdentifier } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";

const serverDirectory = new URL("../..", import.meta.url).pathname;
const originalDatabaseUrl = process.env.DATABASE_URL;

if (originalDatabaseUrl === undefined || originalDatabaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required for Lab 3 integration tests");
}

const testDatabaseName = `toktickit_lab3_${randomUUID().replaceAll("-", "")}`;
const adminDatabaseUrl = new URL(originalDatabaseUrl);
adminDatabaseUrl.pathname = "/postgres";
adminDatabaseUrl.searchParams.delete("schema");
const testDatabaseUrl = new URL(originalDatabaseUrl);
testDatabaseUrl.pathname = `/${testDatabaseName}`;
testDatabaseUrl.searchParams.set("schema", "public");
const adminClient = new Client({ connectionString: adminDatabaseUrl.href });
let adminConnected = false;
let app: Express;
let prisma: PrismaClient;
let userId: number;
let csrfToken: string;
let cookie: string;
const password = "correct horse battery staple";

const origin = "http://localhost:5173";

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

const getJsonString = (object: JsonObject, key: string): string => {
  const value = object[key];

  if (typeof value !== "string") {
    throw new TypeError(`Expected ${key} to be a string`);
  }

  return value;
};

const getJsonBoolean = (object: JsonObject, key: string): boolean => {
  const value = object[key];

  if (typeof value !== "boolean") {
    throw new TypeError(`Expected ${key} to be a boolean`);
  }

  return value;
};

const login = async (email = "ada@example.test", suppliedPassword = password) =>
  await request(app)
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password: suppliedPassword });

const authenticate = async () => {
  const response = await login();
  assert.equal(response.status, 200, response.text);
  const [sessionCookie] = response.headers["set-cookie"] ?? [];
  if (sessionCookie === undefined) {
    throw new Error("Login response did not include a session cookie.");
  }
  [cookie] = sessionCookie.split(";");
  csrfToken = getJsonString(parseJson(response), "csrfToken");
  return response;
};

beforeAll(async () => {
  await adminClient.connect();
  adminConnected = true;
  await adminClient.query(
    `CREATE DATABASE ${escapeIdentifier(testDatabaseName)}`
  );
  process.env.DATABASE_URL = testDatabaseUrl.href;
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
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.relatedSystem.deleteMany();
  await prisma.category.deleteMany();
  const category = await prisma.category.create({
    data: { displayOrder: 1, name: "Network" },
  });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { displayOrder: 1, name: "Campus Wi-Fi" },
  });
  const createdUser = await prisma.user.create({
    data: {
      displayName: "Ada Requester",
      email: "ada@example.test",
      mustChangePassword: false,
      passwordHash: await argon2.hash(password, {
        memoryCost: 19_456,
        parallelism: 1,
        timeCost: 2,
        type: argon2.argon2id,
      }),
    },
  });
  userId = createdUser.id;
  void category;
  void relatedSystem;
});

afterAll(async () => {
  await prisma.$disconnect();
  if (adminConnected) {
    await adminClient.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [testDatabaseName]
    );
    await adminClient.query(
      `DROP DATABASE IF EXISTS ${escapeIdentifier(testDatabaseName)}`
    );
    await adminClient.end();
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("Lab 3 authentication", () => {
  it("signs in with a rotated opaque session and returns safe current-user state", async () => {
    const response = await authenticate();
    const responseBody = parseJson(response);
    const responseUser = getJsonObject(responseBody, "user");

    assert.equal(responseUser.id, userId);
    assert.equal(getJsonString(responseUser, "role"), "Requester");
    assert.equal(getJsonBoolean(responseUser, "mustChangePassword"), false);
    assert.equal("passwordHash" in responseUser, false);
    assert.match(
      getJsonString(responseBody, "csrfToken"),
      /^[A-Za-z0-9_-]{43}$/u
    );
    const [sessionCookie] = response.headers["set-cookie"] ?? [];
    if (sessionCookie === undefined) {
      throw new Error("Login response did not include a session cookie.");
    }
    assert.match(
      sessionCookie,
      /toktickit_session=[A-Za-z0-9_-]{43}; Max-Age=28800; Path=\/; HttpOnly; SameSite=Lax/u
    );

    const sessions = await prisma.session.findMany();
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.tokenHash.includes(cookie.split("=")[1]), false);

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    assert.equal(me.status, 200);
    const meBody = parseJson(me);
    assert.equal(
      getJsonString(getJsonObject(meBody, "user"), "email"),
      "ada@example.test"
    );
    assert.equal(getJsonString(meBody, "csrfToken"), csrfToken);
  });

  it("keeps unknown and wrong credentials generic and handles inactive accounts safely", async () => {
    const unknown = await login("unknown@example.test");
    const wrong = await login("ada@example.test", "wrong horse battery staple");
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(
      getJsonString(getJsonObject(parseJson(unknown), "error"), "code"),
      "INVALID_CREDENTIALS"
    );
    assert.deepEqual(parseJson(unknown), parseJson(wrong));

    await prisma.user.update({
      data: { isActive: false },
      where: { id: userId },
    });
    const inactiveWrong = await login(
      "ada@example.test",
      "wrong horse battery staple"
    );
    const inactiveCorrect = await login();
    assert.equal(inactiveWrong.status, 401);
    assert.equal(inactiveCorrect.status, 403);
    assert.equal(
      getJsonString(getJsonObject(parseJson(inactiveCorrect), "error"), "code"),
      "ACCOUNT_INACTIVE"
    );
    assert.equal(await prisma.session.count(), 0);
  });

  it("requires CSRF and rejects the obsolete identity header", async () => {
    await authenticate();
    const missingCsrf = await request(app)
      .post("/api/tickets")
      .set("Origin", origin)
      .set("Cookie", cookie)
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("requestedPriority", "High")
      .field("summary", "Network issue")
      .field("description", "The requester cannot reach the campus network.");
    assert.equal(missingCsrf.status, 403);
    assert.equal(
      getJsonString(getJsonObject(parseJson(missingCsrf), "error"), "code"),
      "CSRF_INVALID"
    );

    const obsolete = await request(app)
      .get("/api/development-requesters")
      .expect(404);
    assert.equal(
      getJsonString(getJsonObject(parseJson(obsolete), "error"), "code"),
      "NOT_FOUND"
    );
  });

  it("restricts first login until password replacement, then revokes the old session", async () => {
    await prisma.user.update({
      data: { mustChangePassword: true },
      where: { id: userId },
    });
    const restricted = await authenticate();
    const restrictedCookie = cookie;
    const restrictedCsrf = csrfToken;
    assert.equal(
      getJsonBoolean(
        getJsonObject(parseJson(restricted), "user"),
        "mustChangePassword"
      ),
      true
    );
    const [restrictedSessionCookie] = restricted.headers["set-cookie"] ?? [];
    if (restrictedSessionCookie === undefined) {
      throw new Error("Restricted login did not include a session cookie.");
    }
    assert.match(restrictedSessionCookie, /Max-Age=900/u);

    const blocked = await request(app)
      .get("/api/categories")
      .set("Cookie", restrictedCookie);
    assert.equal(blocked.status, 403);
    assert.equal(
      getJsonString(getJsonObject(parseJson(blocked), "error"), "code"),
      "PASSWORD_CHANGE_REQUIRED"
    );

    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Origin", origin)
      .set("Cookie", restrictedCookie)
      .set("X-CSRF-Token", restrictedCsrf)
      .send({
        currentPassword: password,
        newPassword: "new correct horse phrase",
      });
    assert.equal(changed.status, 200);
    const [newSessionCookie] = changed.headers["set-cookie"] ?? [];
    if (newSessionCookie === undefined) {
      throw new Error("Password change did not include a session cookie.");
    }
    const [newCookie] = newSessionCookie.split(";");
    assert.notEqual(newCookie, restrictedCookie);
    assert.equal(
      getJsonBoolean(
        getJsonObject(parseJson(changed), "user"),
        "mustChangePassword"
      ),
      false
    );
    const oldSessionResponse = await request(app)
      .get("/api/auth/me")
      .set("Cookie", restrictedCookie);
    assert.equal(oldSessionResponse.status, 401);
  });

  it("limits repeated failed attempts and invalidates logout replay", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // Each request must update the rolling account counter before the next.
      // oxlint-disable-next-line no-await-in-loop
      const failedAttempt = await login(
        "ada@example.test",
        "wrong horse battery staple"
      );
      assert.equal(failedAttempt.status, 401);
    }
    const throttled = await login(
      "ada@example.test",
      "wrong horse battery staple"
    );
    assert.equal(throttled.status, 429);
    assert.match(throttled.headers["retry-after"], /^\d+$/u);

    await prisma.loginAttempt.deleteMany();
    await authenticate();
    const loggedOut = await request(app)
      .post("/api/auth/logout")
      .set("Origin", origin)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({});
    assert.equal(loggedOut.status, 204);
    const replay = await request(app).get("/api/auth/me").set("Cookie", cookie);
    assert.equal(replay.status, 401);
  });
});
