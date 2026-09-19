import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { Client } from "pg";

// oxlint-disable no-await-in-loop -- Migrations and seed reruns must remain ordered.
// oxlint-disable unicorn/no-await-expression-member -- Each query is asserted at its exact fixture boundary.

dotenv.config({ path: path.join(import.meta.dirname, "../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error(
    "DATABASE_URL is required for migration preservation checks."
  );
}

const migrationDirectory = path.join(
  import.meta.dirname,
  "../prisma/migrations"
);
const legacyMigrations = [
  "20260808113350_add_category/migration.sql",
  "20260902150000_add_requester_ticketing/migration.sql",
  "20260903162556_drop_updated_at_defaults/migration.sql",
] as const;
const postIdentityMigrations = [
  "20260909120000_authentication_and_user_migration/migration.sql",
  "20260915120000_staff_ticket_queue/migration.sql",
  "20260916170000_public_comments/migration.sql",
  "20260916180000_internal_notes/migration.sql",
] as const;

const quoteIdentifier = (value: string): string => {
  if (!/^[a-z0-9_]+$/u.test(value)) {
    throw new Error(`Unsafe database identifier: ${value}`);
  }

  return `"${value}"`;
};

const withDatabaseName = (name: string): string => {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  url.searchParams.delete("schema");
  return url.toString();
};

const adminDatabaseUrl = (): string => {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  url.searchParams.delete("schema");
  return url.toString();
};

const migrationSql = async (relativePath: string): Promise<string> =>
  await readFile(path.join(migrationDirectory, relativePath), "utf-8");

const createDatabase = async (name: string): Promise<void> => {
  const client = new Client({ connectionString: adminDatabaseUrl() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
  } finally {
    await client.end();
  }
};

const dropDatabase = async (name: string): Promise<void> => {
  const client = new Client({ connectionString: adminDatabaseUrl() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)}`);
  } finally {
    await client.end();
  }
};

const runMigrations = async (
  client: Client,
  migrations: readonly string[]
): Promise<void> => {
  for (const relativePath of migrations) {
    const sql = await migrationSql(relativePath);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
};

const connectToDatabase = async (name: string): Promise<Client> => {
  const client = new Client({ connectionString: withDatabaseName(name) });
  await client.connect();
  return client;
};

interface Snapshot {
  attachment: {
    byteSize: number;
    id: number;
    removalReason: string;
    removedAt: Date;
    removedByUserId: number;
    storageKey: string;
    ticketId: number;
    uploadedAt: Date;
  };
  category: { createdAt: Date; id: number; name: string; updatedAt: Date };
  relatedSystem: { createdAt: Date; id: number; name: string };
  requester: {
    createdAt: Date;
    displayName: string;
    email: string;
    id: number;
    isActive: boolean;
    updatedAt: Date;
  };
  ticket: {
    categoryId: number;
    createdAt: Date;
    description: string;
    id: number;
    relatedSystemId: number;
    requesterId: number;
    requestedPriority: string;
    summary: string;
    ticketDate: Date;
    ticketNumber: string;
    updatedAt: Date;
  };
}

const requireRow = <T>(rows: readonly T[], label: string): T => {
  const [row] = rows;
  if (row === undefined) {
    throw new Error(`Expected ${label} row.`);
  }

  return row;
};

const legacyFixture = async (client: Client): Promise<Snapshot> => {
  const createdAt = new Date("2025-01-02T03:04:05.678Z");
  const updatedAt = new Date("2025-02-03T04:05:06.789Z");
  const ticketDate = new Date("2025-03-04T05:06:07.890Z");
  const uploadedAt = new Date("2025-04-05T06:07:08.901Z");
  const removedAt = new Date("2025-05-06T07:08:09.012Z");

  const category = requireRow(
    (
      await client.query<Snapshot["category"]>(
        `INSERT INTO "Category" ("name", "createdAt", "updatedAt")
         VALUES ($1, $2, $3)
         RETURNING "id", "name", "createdAt", "updatedAt"`,
        ["Legacy Category", createdAt, updatedAt]
      )
    ).rows,
    "legacy Category"
  );
  const relatedSystem = requireRow(
    (
      await client.query<{ createdAt: Date; id: number; name: string }>(
        `INSERT INTO "RelatedSystem" ("name", "createdAt", "updatedAt")
         VALUES ($1, $2, $3)
         RETURNING "id", "name", "createdAt"`,
        ["Legacy System", createdAt, updatedAt]
      )
    ).rows,
    "legacy RelatedSystem"
  );
  const requester = requireRow(
    (
      await client.query<Snapshot["requester"]>(
        `INSERT INTO "DevelopmentRequester"
          ("displayName", "email", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING "id", "displayName", "email", "isActive", "createdAt", "updatedAt"`,
        [
          "  Legacy Requester  ",
          " Legacy@Example.test ",
          true,
          createdAt,
          updatedAt,
        ]
      )
    ).rows,
    "legacy DevelopmentRequester"
  );
  const ticket = requireRow(
    (
      await client.query<Snapshot["ticket"]>(
        `INSERT INTO "Ticket"
          ("ticketNumber", "ticketDate", "requesterId", "categoryId",
           "relatedSystemId", "summary", "description", "requestedPriority",
           "currentStatus", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'New', $9, $10)
         RETURNING "id", "ticketNumber", "ticketDate", "requesterId", "categoryId",
           "relatedSystemId", "summary", "description", "requestedPriority",
           "createdAt", "updatedAt"`,
        [
          "TKT-LEGACY-001",
          ticketDate,
          requester.id,
          category.id,
          relatedSystem.id,
          "Legacy ticket summary",
          "Legacy ticket description",
          "Urgent",
          createdAt,
          updatedAt,
        ]
      )
    ).rows,
    "legacy Ticket"
  );
  const attachment = requireRow(
    (
      await client.query<Snapshot["attachment"]>(
        `INSERT INTO "Attachment"
          ("ticketId", "originalFilename", "storageKey", "mediaType", "byteSize",
           "uploadedAt", "removedAt", "removalReason", "removedByRequesterId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING "id", "ticketId", "storageKey", "byteSize", "uploadedAt",
           "removedAt", "removalReason", "removedByRequesterId" AS "removedByUserId"`,
        [
          ticket.id,
          "legacy-evidence.txt",
          "legacy-storage-key",
          "text/plain",
          17,
          uploadedAt,
          removedAt,
          "Legacy cleanup",
          requester.id,
        ]
      )
    ).rows,
    "legacy Attachment"
  );

  return {
    attachment,
    category,
    relatedSystem,
    requester,
    ticket,
  };
};

const assertSameTime = (actual: Date, expected: Date, label: string): void => {
  assert.equal(actual.getTime(), expected.getTime(), label);
};

const assertPreserved = async (
  client: Client,
  snapshot: Snapshot
): Promise<void> => {
  const category = requireRow(
    (
      await client.query<Snapshot["category"]>(
        `SELECT "id", "name", "createdAt", "updatedAt"
         FROM "Category" WHERE "id" = $1`,
        [snapshot.category.id]
      )
    ).rows,
    "migrated Category"
  );
  assert.deepEqual(category, snapshot.category);

  const relatedSystem = requireRow(
    (
      await client.query<Snapshot["relatedSystem"]>(
        `SELECT "id", "name", "createdAt" FROM "RelatedSystem" WHERE "id" = $1`,
        [snapshot.relatedSystem.id]
      )
    ).rows,
    "migrated RelatedSystem"
  );
  assert.deepEqual(relatedSystem, snapshot.relatedSystem);

  const requester = requireRow(
    (
      await client.query<Snapshot["requester"]>(
        `SELECT "id", "displayName", "email", "isActive", "createdAt", "updatedAt"
         FROM "User" WHERE "id" = $1`,
        [snapshot.requester.id]
      )
    ).rows,
    "migrated User"
  );
  assert.equal(requester.id, snapshot.requester.id);
  assert.equal(requester.displayName, "Legacy Requester");
  assert.equal(requester.email, "legacy@example.test");
  assert.equal(requester.isActive, snapshot.requester.isActive);
  assertSameTime(
    requester.createdAt,
    snapshot.requester.createdAt,
    "User createdAt"
  );
  assertSameTime(
    requester.updatedAt,
    snapshot.requester.updatedAt,
    "User updatedAt"
  );

  const ticket = requireRow(
    (
      await client.query<Snapshot["ticket"]>(
        `SELECT "id", "ticketNumber", "ticketDate", "requesterId", "categoryId",
           "relatedSystemId", "summary", "description", "requestedPriority",
           "createdAt", "updatedAt"
         FROM "Ticket" WHERE "id" = $1`,
        [snapshot.ticket.id]
      )
    ).rows,
    "migrated Ticket"
  );
  assert.equal(ticket.id, snapshot.ticket.id);
  assert.equal(ticket.ticketNumber, snapshot.ticket.ticketNumber);
  assert.equal(ticket.requesterId, snapshot.requester.id);
  assert.equal(ticket.categoryId, snapshot.category.id);
  assert.equal(ticket.relatedSystemId, snapshot.relatedSystem.id);
  assert.equal(ticket.summary, snapshot.ticket.summary);
  assert.equal(ticket.description, snapshot.ticket.description);
  assert.equal(ticket.requestedPriority, snapshot.ticket.requestedPriority);
  assertSameTime(
    ticket.ticketDate,
    snapshot.ticket.ticketDate,
    "Ticket ticketDate"
  );
  assertSameTime(
    ticket.createdAt,
    snapshot.ticket.createdAt,
    "Ticket createdAt"
  );
  assertSameTime(
    ticket.updatedAt,
    snapshot.ticket.updatedAt,
    "Ticket updatedAt"
  );

  const attachment = requireRow(
    (
      await client.query<Snapshot["attachment"]>(
        `SELECT "id", "ticketId", "storageKey", "byteSize", "uploadedAt",
           "removedAt", "removalReason", "removedByUserId"
         FROM "Attachment" WHERE "id" = $1`,
        [snapshot.attachment.id]
      )
    ).rows,
    "migrated Attachment"
  );
  assert.equal(attachment.id, snapshot.attachment.id);
  assert.equal(attachment.ticketId, snapshot.ticket.id);
  assert.equal(attachment.storageKey, snapshot.attachment.storageKey);
  assert.equal(attachment.byteSize, snapshot.attachment.byteSize);
  assertSameTime(
    attachment.uploadedAt,
    snapshot.attachment.uploadedAt,
    "Attachment uploadedAt"
  );
  assertSameTime(
    attachment.removedAt,
    snapshot.attachment.removedAt,
    "Attachment removedAt"
  );
  assert.equal(attachment.removalReason, snapshot.attachment.removalReason);
  assert.equal(attachment.removedByUserId, snapshot.requester.id);
};

const assertCollisionAbortsMigration = async (
  client: Client
): Promise<void> => {
  await runMigrations(client, legacyMigrations);
  await client.query(
    `INSERT INTO "DevelopmentRequester"
      ("displayName", "email", "updatedAt")
     VALUES ('Collision One', 'Collision@Example.test', CURRENT_TIMESTAMP),
            ('Collision Two', ' collision@example.test ', CURRENT_TIMESTAMP)`
  );

  const migration = await migrationSql(
    "20260909120000_authentication_and_user_migration/migration.sql"
  );
  await client.query("BEGIN");
  try {
    await client.query(migration);
    assert.fail("Normalized email collision migration unexpectedly succeeded.");
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    assert.match(
      error instanceof Error ? error.message : String(error),
      /conflicting normalized emails/u
    );
  }
};

const runSeed = (name: string): void => {
  execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
    cwd: path.join(import.meta.dirname, ".."),
    env: { ...process.env, DATABASE_URL: withDatabaseName(name) },
    stdio: "pipe",
    timeout: 120_000,
  });
};

const countSeedTables = async (
  client: Client
): Promise<Record<string, number>> => {
  const result = await client.query<{
    categories: string;
    relatedSystems: string;
    tickets: string;
    users: string;
  }>(
    `SELECT
       (SELECT count(*)::text FROM "Category") AS "categories",
       (SELECT count(*)::text FROM "RelatedSystem") AS "relatedSystems",
       (SELECT count(*)::text FROM "Ticket") AS "tickets",
       (SELECT count(*)::text FROM "User") AS "users"`
  );
  const row = requireRow(result.rows, "seed count");
  return {
    categories: Number(row.categories),
    relatedSystems: Number(row.relatedSystems),
    tickets: Number(row.tickets),
    users: Number(row.users),
  };
};

const assertSeedIsIdempotent = async (
  client: Client,
  databaseName: string
): Promise<void> => {
  runSeed(databaseName);
  const firstCounts = await countSeedTables(client);
  assert.deepEqual(firstCounts, {
    categories: 5,
    relatedSystems: 8,
    tickets: 9,
    users: 12,
  });

  await client.query(
    `UPDATE "Category"
       SET "name" = 'Edited Network'
     WHERE "seedKey" = 'lab3:category:network'`
  );
  await client.query(
    `UPDATE "User"
       SET "displayName" = 'Edited Administrator',
           "email" = 'edited-administrator@example.test',
           "passwordHash" = 'edited-password-hash',
           "mustChangePassword" = false,
           "role" = 'Requester'
     WHERE "seedKey" = 'lab3:user:admin-1'`
  );
  await client.query(
    `UPDATE "Ticket"
       SET "summary" = 'Edited seeded ticket'
     WHERE "seedKey" = 'lab3:ticket:new-unassigned'`
  );

  runSeed(databaseName);
  runSeed(databaseName);
  const finalCounts = await countSeedTables(client);
  assert.deepEqual(finalCounts, firstCounts);

  const edited = requireRow(
    (
      await client.query<{
        categoryName: string;
        displayName: string;
        email: string;
        passwordHash: string;
        role: string;
        summary: string;
      }>(
        `SELECT
           (SELECT "name" FROM "Category"
             WHERE "seedKey" = 'lab3:category:network') AS "categoryName",
           (SELECT "displayName" FROM "User"
             WHERE "seedKey" = 'lab3:user:admin-1') AS "displayName",
           (SELECT "email" FROM "User"
             WHERE "seedKey" = 'lab3:user:admin-1') AS "email",
           (SELECT "passwordHash" FROM "User"
             WHERE "seedKey" = 'lab3:user:admin-1') AS "passwordHash",
           (SELECT "role"::text FROM "User"
             WHERE "seedKey" = 'lab3:user:admin-1') AS "role",
           (SELECT "summary" FROM "Ticket"
             WHERE "seedKey" = 'lab3:ticket:new-unassigned') AS "summary"`
      )
    ).rows,
    "edited seed rows"
  );
  assert.deepEqual(edited, {
    categoryName: "Edited Network",
    displayName: "Edited Administrator",
    email: "edited-administrator@example.test",
    passwordHash: "edited-password-hash",
    role: "Requester",
    summary: "Edited seeded ticket",
  });
};

const run = async (): Promise<void> => {
  const suffix = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const preservedDatabase = `toktickit_mig_${suffix}`;
  const collisionDatabase = `toktickit_col_${suffix}`;
  let preservedClient: Client | undefined;
  let collisionClient: Client | undefined;

  try {
    await createDatabase(preservedDatabase);
    preservedClient = await connectToDatabase(preservedDatabase);
    await runMigrations(preservedClient, legacyMigrations);
    const snapshot = await legacyFixture(preservedClient);
    await runMigrations(preservedClient, postIdentityMigrations);
    await assertPreserved(preservedClient, snapshot);
    await assertSeedIsIdempotent(preservedClient, preservedDatabase);

    await createDatabase(collisionDatabase);
    collisionClient = await connectToDatabase(collisionDatabase);
    await assertCollisionAbortsMigration(collisionClient);

    console.info(
      "Migration preservation passed: legacy rows survived and normalized-email collisions aborted."
    );
  } finally {
    await preservedClient?.end();
    await collisionClient?.end();
    await dropDatabase(preservedDatabase);
    await dropDatabase(collisionDatabase);
  }
};

await run();
