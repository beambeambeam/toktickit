import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Express } from "express";
import { Client, escapeIdentifier } from "pg";
import request from "supertest";

import type { PrismaClient } from "../src/generated/prisma/client.js";

const serverDirectory = fileURLToPath(new URL("..", import.meta.url));
const originalDatabaseUrl = process.env.DATABASE_URL;

if (originalDatabaseUrl === undefined || originalDatabaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required for Category integration tests");
}

const testDatabaseName = `toktickit_test_${randomUUID().replaceAll("-", "")}`;
const adminDatabaseUrl = new URL(originalDatabaseUrl);
adminDatabaseUrl.pathname = "/postgres";
adminDatabaseUrl.searchParams.delete("schema");

const testDatabaseUrl = new URL(originalDatabaseUrl);
testDatabaseUrl.pathname = `/${testDatabaseName}`;
testDatabaseUrl.searchParams.set("schema", "public");

const adminClient = new Client({ connectionString: adminDatabaseUrl.href });

let app: Express;
let prisma: PrismaClient;

before(async () => {
  await adminClient.connect();
  await adminClient.query(
    `CREATE DATABASE ${escapeIdentifier(testDatabaseName)}`
  );

  process.env.DATABASE_URL = testDatabaseUrl.href;
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: serverDirectory,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl.href },
    stdio: "pipe",
  });

  const { app: importedApp } = await import("../src/app.js");
  const { prisma: importedPrisma } = await import("../src/db/client.js");
  app = importedApp;
  prisma = importedPrisma;
});

beforeEach(async () => {
  await prisma.category.deleteMany();
});

after(async () => {
  await prisma.$disconnect();
  await adminClient.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [testDatabaseName]
  );
  await adminClient.query(
    `DROP DATABASE IF EXISTS ${escapeIdentifier(testDatabaseName)}`
  );
  await adminClient.end();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

void describe("Categories API", () => {
  void it("returns every stored Category ordered by ascending ID", async () => {
    await prisma.category.createMany({
      data: [
        { id: 30, name: "Network" },
        { id: 10, name: "Account and Access" },
        { id: 20, name: "Hardware" },
      ],
    });

    const response = await request(app)
      .get("/api/categories")
      .expect("Content-Type", /json/u)
      .expect(200);

    assert.deepEqual(response.body, [
      { id: 10, name: "Account and Access" },
      { id: 20, name: "Hardware" },
      { id: 30, name: "Network" },
    ]);
  });
});
