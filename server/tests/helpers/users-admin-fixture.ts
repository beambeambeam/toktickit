import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import argon2 from "argon2";
import type { Express } from "express";
import { Client, escapeIdentifier } from "pg";
import request from "supertest";

import type { PrismaClient } from "../../src/generated/prisma/client.js";

export const TEST_ORIGIN = "http://localhost:5173";
export const TEST_PASSWORD = "correct horse battery staple";

export type FixtureUserRole = "Requester" | "ITStaff" | "Administrator";

export interface CreateFixtureUserInput {
  displayName: string;
  email: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  password?: string | null;
  role: FixtureUserRole;
}

export interface AuthenticatedFixtureSession {
  cookie: string;
  csrfToken: string;
  response: {
    body: unknown;
    status: number;
  };
}

export interface UsersAdminFixture {
  app: Express;
  authenticate: (
    email: string,
    password?: string
  ) => Promise<AuthenticatedFixtureSession>;
  createUser: (
    input: CreateFixtureUserInput
  ) => ReturnType<PrismaClient["user"]["create"]>;
  databaseName: string;
  prisma: PrismaClient;
  reset: () => Promise<void>;
  teardown: () => Promise<void>;
}

const serverDirectory = fileURLToPath(new URL("../..", import.meta.url));

const passwordHashOptions = {
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
  type: argon2.argon2id,
} as const;

const getExplicitTestDatabaseUrl = (): URL => {
  const configuredUrl = process.env.TOKTICKIT_TEST_DATABASE_URL;

  if (configuredUrl === undefined || configuredUrl.length === 0) {
    throw new Error(
      "TOKTICKIT_TEST_DATABASE_URL is required; refusing to use DATABASE_URL."
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("TOKTICKIT_TEST_DATABASE_URL must be a PostgreSQL URL.");
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error("TOKTICKIT_TEST_DATABASE_URL must be a PostgreSQL URL.");
  }

  return parsedUrl;
};

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object response.");
  }

  return value;
};

const getJsonString = (
  object: Record<string, unknown>,
  key: string
): string => {
  const value = object[key];

  if (typeof value !== "string") {
    throw new TypeError(`Expected ${key} to be a string.`);
  }

  return value;
};

export const createUsersAdminFixture = async (): Promise<UsersAdminFixture> => {
  const configuredDatabaseUrl = getExplicitTestDatabaseUrl();
  const databaseName = `toktickit_review_${randomUUID().replaceAll("-", "")}`;
  const adminDatabaseUrl = new URL(configuredDatabaseUrl);
  adminDatabaseUrl.pathname = "/postgres";
  adminDatabaseUrl.searchParams.delete("schema");
  const testDatabaseUrl = new URL(configuredDatabaseUrl);
  testDatabaseUrl.pathname = `/${databaseName}`;
  testDatabaseUrl.searchParams.set("schema", "public");

  const adminClient = new Client({
    connectionString: adminDatabaseUrl.href,
  });
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let adminConnected = false;
  let databaseCreated = false;
  let database: PrismaClient | undefined;
  let cleanedUp = false;

  const cleanup = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    try {
      await database?.$disconnect();
    } finally {
      try {
        if (adminConnected && databaseCreated) {
          try {
            await adminClient.query(
              "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
              [databaseName]
            );
          } finally {
            await adminClient.query(
              `DROP DATABASE IF EXISTS ${escapeIdentifier(databaseName)}`
            );
          }
        }
      } finally {
        if (adminConnected) {
          await adminClient.end();
        }

        if (previousDatabaseUrl === undefined) {
          delete process.env.DATABASE_URL;
        } else {
          process.env.DATABASE_URL = previousDatabaseUrl;
        }
      }
    }
  };

  try {
    await adminClient.connect();
    adminConnected = true;
    await adminClient.query(
      `CREATE DATABASE ${escapeIdentifier(databaseName)}`
    );
    databaseCreated = true;

    process.env.DATABASE_URL = testDatabaseUrl.href;
    execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: serverDirectory,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl.href },
      stdio: "pipe",
    });

    const importedDatabase = await import("../../src/db/client.js");
    database = importedDatabase.prisma;
    const importedApp = await import("../../src/app.js");
    const getDatabase = (): PrismaClient => {
      if (database === undefined) {
        throw new Error("The Prisma fixture client was not initialized.");
      }

      return database;
    };

    const reset = async (): Promise<void> => {
      const activeDatabase = getDatabase();
      await activeDatabase.session.deleteMany();
      await activeDatabase.loginAttempt.deleteMany();
      await activeDatabase.internalNote.deleteMany();
      await activeDatabase.attachment.deleteMany();
      await activeDatabase.ticket.deleteMany();
      await activeDatabase.user.deleteMany();
      await activeDatabase.relatedSystem.deleteMany();
      await activeDatabase.category.deleteMany();
    };

    const createUser = async (input: CreateFixtureUserInput) => {
      const activeDatabase = getDatabase();
      const passwordHash =
        input.password === null
          ? null
          : await argon2.hash(
              input.password ?? TEST_PASSWORD,
              passwordHashOptions
            );

      return await activeDatabase.user.create({
        data: {
          displayName: input.displayName,
          email: input.email,
          isActive: input.isActive ?? true,
          mustChangePassword: input.mustChangePassword ?? false,
          passwordHash,
          role: input.role,
        },
      });
    };

    const authenticate = async (
      email: string,
      password = TEST_PASSWORD
    ): Promise<AuthenticatedFixtureSession> => {
      const response = await request(importedApp.app)
        .post("/api/auth/login")
        .set("Origin", TEST_ORIGIN)
        .send({ email, password });
      const [sessionCookie] = response.headers["set-cookie"] ?? [];

      if (sessionCookie === undefined) {
        throw new Error(
          `Login did not include a session cookie: ${response.text}`
        );
      }

      const responseBody = parseJsonObject(response.body);

      return {
        cookie: sessionCookie.split(";")[0] ?? "",
        csrfToken: getJsonString(responseBody, "csrfToken"),
        response,
      };
    };

    return {
      app: importedApp.app,
      authenticate,
      createUser,
      databaseName,
      prisma: getDatabase(),
      reset,
      teardown: cleanup,
    };
  } catch (error: unknown) {
    let cleanupFailed = false;
    let cleanupError: unknown;

    try {
      await cleanup();
    } catch (caughtCleanupError: unknown) {
      cleanupFailed = true;
      cleanupError = caughtCleanupError;
    }

    if (cleanupFailed) {
      const cleanupMessage =
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError);
      throw new Error(
        `Disposable test database initialization failed; cleanup also failed: ${cleanupMessage}`,
        { cause: error }
      );
    }

    throw error;
  }
};
