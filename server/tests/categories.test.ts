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
let adminClientConnected = false;

let app: Express;
let prisma: PrismaClient | undefined;

const getPrisma = (): PrismaClient => {
  if (prisma === undefined) {
    throw new Error("Category integration database is not initialized");
  }

  return prisma;
};

before(async () => {
  await adminClient.connect();
  adminClientConnected = true;
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
  await getPrisma().category.deleteMany();
});

after(async () => {
  try {
    if (prisma !== undefined) {
      await prisma.$disconnect();
    }
  } finally {
    try {
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
    } finally {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
});

void describe("Categories API", () => {
  void it("returns every stored Category ordered by ascending ID", async () => {
    await getPrisma().category.createMany({
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

  void it("returns an empty array when no Categories are stored", async () => {
    await request(app)
      .get("/api/categories")
      .expect("Content-Type", /json/u)
      .expect(200, []);
  });

  void it("returns a safe message when the Category query fails", async () => {
    await getPrisma().$executeRawUnsafe(
      'ALTER TABLE "Category" RENAME TO "UnavailableCategory"'
    );

    try {
      await request(app)
        .get("/api/categories")
        .expect("Content-Type", /json/u)
        .expect(500, {
          message: "Unable to retrieve request categories",
        });
    } finally {
      await getPrisma().$executeRawUnsafe(
        'ALTER TABLE "UnavailableCategory" RENAME TO "Category"'
      );
    }
  });
});
