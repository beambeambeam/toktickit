import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Client, escapeIdentifier } from "pg";

// oxlint-disable no-await-in-loop -- Migration and recovery steps run in order.

const configuredUrl = process.env.TOKTICKIT_TEST_DATABASE_URL;
assert.ok(
  configuredUrl !== undefined && configuredUrl.length > 0,
  "TOKTICKIT_TEST_DATABASE_URL is required."
);
const root = path.resolve(import.meta.dirname, "../..");
const migrationsRoot = path.join(root, "prisma/migrations");
const suffix = randomUUID().replaceAll("-", "");
const databaseName = `toktickit_actions_migration_${suffix}`;
const restoredName = `toktickit_actions_restore_${suffix}`;
const databaseUrl = (name: string) => {
  const url = new URL(configuredUrl);
  url.pathname = `/${name}`;
  url.searchParams.delete("schema");
  return url.href;
};
const admin = new Client({ connectionString: databaseUrl("postgres") });
const database = new Client({ connectionString: databaseUrl(databaseName) });
const restored = new Client({ connectionString: databaseUrl(restoredName) });
const storage = await mkdtemp(path.join(os.tmpdir(), "toktickit-actions-"));
const attachmentBytes = Buffer.from("Preserved attachment bytes\n\u0000\u0001");
const attachmentPath = path.join(storage, "legacy-attachment");
const attachmentBackup = path.join(storage, "backup-attachment");
const tables = [
  "User",
  "Ticket",
  "Attachment",
  "PublicComment",
  "InternalNote",
  "Session",
];

interface MigrationRow {
  id: number | string;
  [key: string]: unknown;
}

const snapshot = async (client: Client, names = tables) => {
  const result: Record<string, MigrationRow[]> = {};
  for (const table of names) {
    const rows = await client.query<MigrationRow>(
      `SELECT * FROM ${escapeIdentifier(table)} ORDER BY "id"`
    );
    result[table] = rows.rows;
  }
  return result;
};

const seed = () => {
  execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
    cwd: root,
    env: {
      ...process.env,
      ATTACHMENT_STORAGE_DIR: storage,
      DATABASE_URL: databaseUrl(databaseName),
    },
    stdio: "pipe",
  });
};

const runPrisma = (args: string[]) => {
  execFileSync("pnpm", ["exec", "prisma", ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl(databaseName) },
    stdio: "pipe",
  });
};

const postgresTool = (
  name: "pg_dump" | "pg_restore",
  db: string,
  input?: Buffer
): Buffer => {
  const container = process.env.MIGRATION_POSTGRES_CONTAINER;
  const url = new URL(databaseUrl(db));
  const args =
    name === "pg_dump"
      ? ["--format=custom", "--no-owner", "--no-acl"]
      : ["--no-owner", "--no-acl", "--exit-on-error"];
  if (container !== undefined && container.length > 0) {
    return execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "-e",
        `PGPASSWORD=${decodeURIComponent(url.password)}`,
        container,
        name,
        "-U",
        decodeURIComponent(url.username),
        "-d",
        db,
        ...args,
      ],
      { input, maxBuffer: 20 * 1024 * 1024 }
    );
  }
  return execFileSync(name, ["--dbname", databaseUrl(db), ...args], {
    input,
    maxBuffer: 20 * 1024 * 1024,
  });
};

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${escapeIdentifier(databaseName)}`);
  await admin.query(`CREATE DATABASE ${escapeIdentifier(restoredName)}`);
  await database.connect();
  const migrationEntries = await readdir(migrationsRoot);
  const migrationNames = migrationEntries.filter((name) => /^\d/u.test(name));
  // oxlint-disable-next-line unicorn/no-array-sort -- Sort this fresh array under the server's ES2022 types.
  migrationNames.sort();
  const actionMigration = migrationNames.find((name) =>
    name.includes("action_taken_foundation")
  );
  assert.ok(
    actionMigration !== undefined,
    "The additive Actions Taken migration must exist."
  );
  for (const migrationName of migrationNames.filter(
    (entry) => entry < actionMigration
  )) {
    await database.query(
      await readFile(
        path.join(migrationsRoot, migrationName, "migration.sql"),
        "utf-8"
      )
    );
    runPrisma(["migrate", "resolve", "--applied", migrationName]);
  }
  // Populate every preserved resource before the Lab 4 schema exists.
  await database.query(`
    INSERT INTO "Category" ("name", "updatedAt") VALUES ('Legacy category', CURRENT_TIMESTAMP);
    INSERT INTO "RelatedSystem" ("name", "updatedAt") VALUES ('Legacy system', CURRENT_TIMESTAMP);
    INSERT INTO "User" ("displayName", "email", "role", "updatedAt") VALUES
      ('Legacy requester', 'legacy-requester@example.test', 'Requester', CURRENT_TIMESTAMP),
      ('Legacy worker', 'legacy-worker@example.test', 'ITStaff', CURRENT_TIMESTAMP);
    INSERT INTO "Ticket" ("ticketNumber", "requesterId", "categoryId", "relatedSystemId", "summary", "description", "requestedPriority", "itPriority", "currentStatus", "updatedAt") VALUES
      ('TKT-LEGACY-ACTION', 1, 1, 1, 'Preserved ticket', 'Preserved description', 'Low', 'Low', 'Resolved', '2025-01-01T00:00:00Z');
    INSERT INTO "Attachment" ("ticketId", "originalFilename", "storageKey", "mediaType", "byteSize") VALUES
      (1, 'legacy.txt', 'legacy-attachment', 'text/plain', ${attachmentBytes.length});
    INSERT INTO "PublicComment" ("ticketId", "authorId", "content") VALUES (1, 1, 'Preserved public comment');
    INSERT INTO "InternalNote" ("ticketId", "authorId", "content") VALUES (1, 2, 'Preserved private note');
    INSERT INTO "Session" ("id", "tokenHash", "userId", "csrfSecret", "absoluteExpiresAt") VALUES ('legacy-session', 'legacy-token-hash', 1, 'legacy-csrf-secret', '2027-01-01T00:00:00Z');
  `);
  await writeFile(attachmentPath, attachmentBytes);
  await writeFile(attachmentBackup, await readFile(attachmentPath));
  const before = await snapshot(database);
  const backup = postgresTool("pg_dump", databaseName);
  const actionSql = await readFile(
    path.join(migrationsRoot, actionMigration, "migration.sql"),
    "utf-8"
  );
  // A failed transaction leaves the populated earlier schema intact.
  await database.query("BEGIN");
  await database.query(actionSql);
  await assert.rejects(database.query("SELECT intentionally_missing_column"));
  await database.query("ROLLBACK");
  assert.deepEqual(await snapshot(database), before);
  const absent = await database.query<{ name: string | null }>(
    "SELECT to_regclass('\"ActionTaken\"') AS name"
  );
  assert.equal(absent.rows[0].name, null);
  runPrisma(["migrate", "deploy"]);
  runPrisma(["migrate", "deploy"]);
  const actionTimestamps = await database.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND
       ((table_name = 'ActionTaken' AND column_name IN
         ('createdAt', 'updatedAt', 'startedAt', 'completedAt', 'cancelledAt'))
        OR (table_name = 'ActionEvent' AND column_name = 'createdAt'))`
  );
  assert.equal(actionTimestamps.rows.length, 6);
  assert.ok(
    actionTimestamps.rows.every(
      (column) => column.data_type === "timestamp with time zone"
    ),
    "Action and event timestamps must preserve their timezone."
  );
  assert.deepEqual(await snapshot(database), before);
  const emptyActions = await database.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM "ActionTaken"'
  );
  assert.equal(emptyActions.rows[0].count, 0);
  assert.deepEqual(await readFile(attachmentPath), attachmentBytes);
  seed();
  const utcAction = await database.query<{ createdAt: Date }>(
    'SELECT "createdAt" FROM "ActionTaken" ORDER BY "id" LIMIT 1'
  );
  await database.query("SET TIME ZONE 'Asia/Bangkok'");
  const bangkokAction = await database.query<{ createdAt: Date }>(
    'SELECT "createdAt" FROM "ActionTaken" ORDER BY "id" LIMIT 1'
  );
  assert.deepEqual(bangkokAction.rows, utcAction.rows);
  await database.query("SET TIME ZONE 'UTC'");
  const seededActions = await database.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM "ActionTaken"'
  );
  const actionCount = seededActions.rows[0].count;
  assert.ok(actionCount > 0, "Seed must include demonstration actions.");
  const fixtureCounts = await database.query<{ count: number }>(
    'SELECT count(a."id")::int AS count FROM "Ticket" t LEFT JOIN "ActionTaken" a ON a."ticketId" = t."id" WHERE t."seedKey" LIKE \'lab4:%\' GROUP BY t."id"'
  );
  const counts = fixtureCounts.rows.map((row) => row.count);
  assert.ok(
    counts.includes(0) &&
      counts.includes(1) &&
      counts.some((count) => count > 1),
    "Lab 4 fixtures must demonstrate zero, one, and multiple actions."
  );
  await database.query(
    'UPDATE "ActionTaken" SET "description" = $1 WHERE "id" = (SELECT min("id") FROM "ActionTaken")',
    ["User-edited seed action"]
  );
  const afterSeed = await snapshot(database, [
    ...tables,
    "ActionTaken",
    "ActionEvent",
  ]);
  seed();
  seed();
  assert.deepEqual(
    await snapshot(database, [...tables, "ActionTaken", "ActionEvent"]),
    afterSeed
  );
  for (const table of tables) {
    const legacyRows = before[table];
    const preservedRows = await database.query(
      `SELECT * FROM ${escapeIdentifier(table)} WHERE "id" = ANY($1) ORDER BY "id"`,
      [legacyRows.map((row) => row.id)]
    );
    assert.deepEqual(preservedRows.rows, legacyRows);
  }
  const legacyActions = await database.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM "ActionTaken" WHERE "ticketId" = 1'
  );
  assert.equal(legacyActions.rows[0].count, 0);
  assert.deepEqual(await readFile(attachmentPath), attachmentBytes);
  // Restore the pre-migration database AND storage backup to a second disposable database.
  postgresTool("pg_restore", restoredName, backup);
  await restored.connect();
  assert.deepEqual(await snapshot(restored), before);
  const restoredActions = await restored.query<{ name: string | null }>(
    "SELECT to_regclass('\"ActionTaken\"') AS name"
  );
  assert.equal(restoredActions.rows[0].name, null);
  await rm(attachmentPath);
  await writeFile(attachmentPath, await readFile(attachmentBackup));
  assert.deepEqual(await readFile(attachmentPath), attachmentBytes);
  console.info(
    "Actions Taken migration/recovery passed: populated rows, bytes, transaction rollback, backup restore, zero legacy actions, and insert-only seed reruns."
  );
} finally {
  await database.end();
  await restored.end();
  await admin.query(
    `DROP DATABASE IF EXISTS ${escapeIdentifier(databaseName)} WITH (FORCE)`
  );
  await admin.query(
    `DROP DATABASE IF EXISTS ${escapeIdentifier(restoredName)} WITH (FORCE)`
  );
  await admin.end();
  await rm(storage, { force: true, recursive: true });
}
