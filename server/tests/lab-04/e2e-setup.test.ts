import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, it } from "vitest";

import { createUsersAdminFixture } from "../helpers/users-admin-fixture.js";
import type { UsersAdminFixture } from "../helpers/users-admin-fixture.js";

let fixture: UsersAdminFixture;
beforeAll(async () => {
  fixture = await createUsersAdminFixture();
});
afterAll(async () => {
  await fixture?.teardown();
});

it("E2E setup preserves users referenced by actions or events and removes unused generated users", async () => {
  const requester = await fixture.createUser({
    displayName: "Requester",
    email: "requester@example.test",
    role: "Requester",
  });
  const roles = [
    "creator",
    "assignee",
    "performer",
    "completer",
    "canceller",
    "event-actor",
  ];
  const users = await Promise.all(
    roles.map(
      async (role) =>
        await fixture.createUser({
          displayName: role,
          email: `e2e-created-${role}@example.test`,
          role: "ITStaff",
        })
    )
  );
  const unused = await fixture.createUser({
    displayName: "Unused",
    email: "e2e-created-unused@example.test",
    role: "ITStaff",
  });
  const category = await fixture.prisma.category.create({
    data: { name: "Category" },
  });
  const system = await fixture.prisma.relatedSystem.create({
    data: { name: "System" },
  });
  const ticket = await fixture.prisma.ticket.create({
    data: {
      categoryId: category.id,
      description: "Setup must keep attributed work",
      itPriority: "Low",
      relatedSystemId: system.id,
      requestedPriority: "Low",
      requesterId: requester.id,
      summary: "Preserved action references",
      ticketNumber: "TKT-E2E-SETUP",
    },
  });
  const action = await fixture.prisma.actionTaken.create({
    data: {
      assigneeId: users[1].id,
      cancelledByUserId: users[4].id,
      completedByUserId: users[3].id,
      createdByUserId: users[0].id,
      description: "Preserved action",
      payloadHash: "0".repeat(64),
      performedByUserId: users[2].id,
      requestId: randomUUID(),
      ticketId: ticket.id,
    },
  });
  const event = await fixture.prisma.actionEvent.create({
    data: {
      actionId: action.id,
      actionVersion: 1,
      actorId: users[5].id,
      eventType: "ActionCreated",
    },
  });
  const url = new URL(process.env.TOKTICKIT_TEST_DATABASE_URL ?? "");
  url.pathname = `/${fixture.databaseName}`;
  execFileSync("pnpm", ["exec", "tsx", "scripts/prepare-e2e.ts"], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: url.href },
    stdio: "pipe",
  });
  assert.equal(
    await fixture.prisma.user.count({
      where: { id: { in: users.map((user) => user.id) } },
    }),
    users.length
  );
  assert.equal(
    await fixture.prisma.user.findUnique({ where: { id: unused.id } }),
    null
  );
  assert.deepEqual(
    await fixture.prisma.actionTaken.findUnique({ where: { id: action.id } }),
    action
  );
  assert.deepEqual(
    await fixture.prisma.actionEvent.findUnique({ where: { id: event.id } }),
    event
  );
}, 60_000);
