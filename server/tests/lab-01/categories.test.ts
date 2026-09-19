import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import argon2 from "argon2";
import type { Express } from "express";
import { Client, escapeIdentifier } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";

const serverDirectory = fileURLToPath(new URL("../..", import.meta.url));
const originalDatabaseUrl = process.env.DATABASE_URL;
const canonicalCategoryNames = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
] as const;

interface CategoryResponse {
  id: number;
  name: string;
}

const isCategoryResponse = (value: unknown): value is CategoryResponse =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "number" &&
  "name" in value &&
  typeof value.name === "string";

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getCategoryNames = (value: unknown): string[] => {
  if (
    !isJsonObject(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isCategoryResponse)
  ) {
    throw new TypeError("Expected a category response");
  }

  return value.items.map((category) => category.name);
};

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
let authCookie: string;

const getPrisma = (): PrismaClient => {
  if (prisma === undefined) {
    throw new Error("Category integration database is not initialized");
  }

  return prisma;
};

const runSeed = (): void => {
  execFileSync("pnpm", ["exec", "prisma", "db", "seed"], {
    cwd: serverDirectory,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl.href },
    stdio: "pipe",
  });
};

beforeAll(async () => {
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

  const { app: importedApp } = await import("../../src/app.js");
  const { prisma: importedPrisma } = await import("../../src/db/client.js");
  app = importedApp;
  prisma = importedPrisma;
});

beforeEach(async () => {
  const database = getPrisma();
  await database.session.deleteMany();
  await database.attachment.deleteMany();
  await database.ticket.deleteMany();
  await database.category.deleteMany();
  const passwordHash = await argon2.hash("correct horse battery staple", {
    memoryCost: 19_456,
    parallelism: 1,
    timeCost: 2,
    type: argon2.argon2id,
  });
  await database.user.upsert({
    create: {
      displayName: "Category Tester",
      email: "category-tester@example.test",
      mustChangePassword: false,
      passwordHash,
    },
    update: { mustChangePassword: false, passwordHash },
    where: { email: "category-tester@example.test" },
  });
  const login = await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .send({
      email: "category-tester@example.test",
      password: "correct horse battery staple",
    })
    .expect(200);
  const [sessionCookie] = login.headers["set-cookie"];
  [authCookie] = sessionCookie.split(";");
});

afterAll(async () => {
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

describe("Categories API", () => {
  it("returns the four seeded categories in canonical order", async () => {
    runSeed();

    const response = await request(app)
      .get("/api/categories")
      .set("Cookie", authCookie)
      .expect("Content-Type", /json/u)
      .expect(200);

    assert.deepEqual(getCategoryNames(response.body), canonicalCategoryNames);
  }, 30_000);

  it("keeps seeding idempotent", async () => {
    runSeed();
    runSeed();

    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });

    assert.equal(categories.length, canonicalCategoryNames.length);
    assert.deepEqual(
      categories.map((category) => category.name),
      canonicalCategoryNames
    );
  }, 30_000);

  it("returns every stored Category ordered by ascending ID", async () => {
    await getPrisma().category.createMany({
      data: [
        { id: 30, name: "Network" },
        { id: 10, name: "Account and Access" },
        { id: 20, name: "Hardware" },
      ],
    });

    const response = await request(app)
      .get("/api/categories")
      .set("Cookie", authCookie)
      .expect("Content-Type", /json/u)
      .expect(200);

    assert.deepEqual(response.body, {
      items: [
        { id: 10, name: "Account and Access" },
        { id: 20, name: "Hardware" },
        { id: 30, name: "Network" },
      ],
    });
  });

  it("returns an empty array when no Categories are stored", async () => {
    await request(app)
      .get("/api/categories")
      .set("Cookie", authCookie)
      .expect("Content-Type", /json/u)
      .expect(200, { items: [] });
  });

  it("returns a safe message when the Category query fails", async () => {
    await getPrisma().$executeRawUnsafe(
      'ALTER TABLE "Category" RENAME TO "UnavailableCategory"'
    );

    try {
      await request(app)
        .get("/api/categories")
        .set("Cookie", authCookie)
        .expect("Content-Type", /json/u)
        .expect(500, {
          error: {
            code: "REFERENCE_DATA_UNAVAILABLE",
            message: "Unable to load Categories.",
          },
        });
    } finally {
      await getPrisma().$executeRawUnsafe(
        'ALTER TABLE "UnavailableCategory" RENAME TO "Category"'
      );
    }
  });
});
