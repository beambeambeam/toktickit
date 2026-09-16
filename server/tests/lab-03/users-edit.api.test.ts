import assert from "node:assert/strict";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  createUsersAdminFixture,
  TEST_ORIGIN,
} from "../helpers/users-admin-fixture.js";
import type {
  AuthenticatedFixtureSession,
  UsersAdminFixture,
} from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;
type UserRoleLabel = "Requester" | "IT Staff" | "Administrator";

const adminEmail = "edit-admin@example.test";
const secondAdminEmail = "edit-second-admin@example.test";

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asJsonObject = (value: unknown): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError("Expected a JSON object.");
  }

  return value;
};

const errorCode = (response: { body: unknown }): string => {
  const body = asJsonObject(response.body);
  const error = asJsonObject(body.error);
  const { code } = error;

  if (typeof code !== "string") {
    throw new TypeError("Expected an error code.");
  }

  return code;
};

const responseUser = (response: { body: unknown }): JsonObject =>
  asJsonObject(asJsonObject(response.body).user);

const patchUser = async (
  fixture: UsersAdminFixture,
  session: AuthenticatedFixtureSession,
  userId: number,
  body: Record<string, unknown>
) =>
  await request(fixture.app)
    .patch(`/api/users/${userId}`)
    .set("Origin", TEST_ORIGIN)
    .set("Cookie", session.cookie)
    .set("X-CSRF-Token", session.csrfToken)
    .send(body);

const resetUserPassword = async (
  fixture: UsersAdminFixture,
  session: AuthenticatedFixtureSession,
  userId: number,
  initialPassword: string,
  confirmed = true
) =>
  await request(fixture.app)
    .post(`/api/users/${userId}/initial-password`)
    .set("Origin", TEST_ORIGIN)
    .set("Cookie", session.cookie)
    .set("X-CSRF-Token", session.csrfToken)
    .send({ confirmed, initialPassword });

const hasClearedSessionCookie = (response: {
  headers: Record<string, unknown>;
}) =>
  Array.isArray(response.headers["set-cookie"]) &&
  response.headers["set-cookie"].some(
    (cookie: unknown) =>
      typeof cookie === "string" &&
      cookie.startsWith("toktickit_session=") &&
      cookie.includes("Max-Age=0")
  );

const createUser = async (
  fixture: UsersAdminFixture,
  input: {
    displayName: string;
    email: string;
    isActive?: boolean;
    role: UserRoleLabel;
  }
) =>
  await fixture.createUser({
    displayName: input.displayName,
    email: input.email,
    isActive: input.isActive,
    role: input.role === "IT Staff" ? "ITStaff" : input.role,
  });

describe("Lab 3 administrator account editing and reset", () => {
  let fixture: UsersAdminFixture | undefined;
  let administratorId: number;

  const getFixture = (): UsersAdminFixture => {
    if (fixture === undefined) {
      throw new Error("The API fixture was not initialized.");
    }

    return fixture;
  };

  beforeAll(async () => {
    fixture = await createUsersAdminFixture();
  });

  beforeEach(async () => {
    const activeFixture = getFixture();
    await activeFixture.reset();
    const administrator = await activeFixture.createUser({
      displayName: "Edit Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    administratorId = administrator.id;
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("returns one safe User and denies direct non-Administrator access", async () => {
    const activeFixture = getFixture();
    const target = await createUser(activeFixture, {
      displayName: "Editable Requester",
      email: "editable-requester@example.test",
      role: "Requester",
    });
    const adminSession = await activeFixture.authenticate(adminEmail);
    const detail = await request(activeFixture.app)
      .get(`/api/users/${target.id}`)
      .set("Cookie", adminSession.cookie);

    assert.equal(detail.status, 200, detail.text);
    assert.equal(asJsonObject(detail.body).id, target.id);
    assert.equal(asJsonObject(detail.body).email, target.email);
    assert.equal("passwordHash" in asJsonObject(detail.body), false);

    const requesterSession = await activeFixture.authenticate(target.email);
    const deniedDetail = await request(activeFixture.app)
      .get(`/api/users/${target.id}`)
      .set("Cookie", requesterSession.cookie);
    assert.equal(deniedDetail.status, 403, deniedDetail.text);
    assert.equal(errorCode(deniedDetail), "FORBIDDEN");

    const deniedMalformed = await request(activeFixture.app)
      .get("/api/users/not-an-id")
      .set("Cookie", requesterSession.cookie);
    assert.equal(deniedMalformed.status, 403, deniedMalformed.text);
    assert.equal(errorCode(deniedMalformed), "FORBIDDEN");
  });

  it("validates partial edits and normalizes email before the unique conflict", async () => {
    const activeFixture = getFixture();
    const target = await createUser(activeFixture, {
      displayName: "Original Name",
      email: "original@example.test",
      role: "Requester",
    });
    const duplicate = await createUser(activeFixture, {
      displayName: "Duplicate Name",
      email: "duplicate@example.test",
      role: "Requester",
    });
    const adminSession = await activeFixture.authenticate(adminEmail);

    const invalidResponses = await Promise.all([
      patchUser(activeFixture, adminSession, target.id, {}),
      patchUser(activeFixture, adminSession, target.id, { unexpected: true }),
      patchUser(activeFixture, adminSession, target.id, { role: ["IT Staff"] }),
      patchUser(activeFixture, adminSession, target.id, { isActive: "false" }),
    ]);
    for (const response of invalidResponses) {
      assert.equal(response.status, 400, response.text);
      assert.equal(errorCode(response), "VALIDATION_ERROR");
    }

    const updated = await patchUser(activeFixture, adminSession, target.id, {
      displayName: "  Renamed Requester  ",
      email: " Renamed.Requester@Example.TEST ",
    });
    assert.equal(updated.status, 200, updated.text);
    assert.equal(responseUser(updated).displayName, "Renamed Requester");
    assert.equal(responseUser(updated).email, "renamed.requester@example.test");

    const conflict = await patchUser(activeFixture, adminSession, target.id, {
      email: ` ${duplicate.email.toUpperCase()} `,
    });
    assert.equal(conflict.status, 409, conflict.text);
    assert.equal(errorCode(conflict), "EMAIL_CONFLICT");

    const unchanged = await activeFixture.prisma.user.findUnique({
      select: { displayName: true, email: true },
      where: { id: target.id },
    });
    assert.deepEqual(unchanged, {
      displayName: "Renamed Requester",
      email: "renamed.requester@example.test",
    });
  });

  it("keeps sessions for name/email edits and revokes them for role changes", async () => {
    const activeFixture = getFixture();
    const target = await createUser(activeFixture, {
      displayName: "Editable Staff",
      email: "editable-staff@example.test",
      role: "IT Staff",
    });
    const adminSession = await activeFixture.authenticate(adminEmail);
    const targetSession = await activeFixture.authenticate(target.email);

    const profileUpdate = await patchUser(
      activeFixture,
      adminSession,
      target.id,
      {
        displayName: "Renamed Staff",
        email: "renamed-staff@example.test",
      }
    );
    assert.equal(profileUpdate.status, 200, profileUpdate.text);

    const retainedSession = await request(activeFixture.app)
      .get("/api/auth/me")
      .set("Cookie", targetSession.cookie);
    assert.equal(retainedSession.status, 200, retainedSession.text);
    assert.equal(asJsonObject(retainedSession.body).user !== undefined, true);

    const roleUpdate = await patchUser(activeFixture, adminSession, target.id, {
      role: "Requester",
    });
    assert.equal(roleUpdate.status, 200, roleUpdate.text);
    assert.equal(responseUser(roleUpdate).role, "Requester");

    const revokedSession = await request(activeFixture.app)
      .get("/api/auth/me")
      .set("Cookie", targetSession.cookie);
    assert.equal(revokedSession.status, 401, revokedSession.text);
  });

  it("resets a target password only after confirmation and revokes target access", async () => {
    const activeFixture = getFixture();
    const target = await createUser(activeFixture, {
      displayName: "Reset Target",
      email: "reset-target@example.test",
      role: "Requester",
    });
    const adminSession = await activeFixture.authenticate(adminEmail);
    const targetSession = await activeFixture.authenticate(target.email);
    const rejected = await resetUserPassword(
      activeFixture,
      adminSession,
      target.id,
      "a rejected reset phrase",
      false
    );
    assert.equal(rejected.status, 400, rejected.text);
    assert.equal(errorCode(rejected), "VALIDATION_ERROR");

    const acceptedPassword = "a fresh initial reset phrase";
    const accepted = await resetUserPassword(
      activeFixture,
      adminSession,
      target.id,
      acceptedPassword
    );
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(responseUser(accepted).mustChangePassword, true);
    assert.equal(
      JSON.stringify(accepted.body).includes(acceptedPassword),
      false
    );

    const stored = await activeFixture.prisma.user.findUnique({
      select: { mustChangePassword: true, passwordHash: true },
      where: { id: target.id },
    });
    assert.equal(stored?.mustChangePassword, true);
    assert.notEqual(stored?.passwordHash, target.passwordHash);

    const revokedSession = await request(activeFixture.app)
      .get("/api/auth/me")
      .set("Cookie", targetSession.cookie);
    assert.equal(revokedSession.status, 401, revokedSession.text);

    const restrictedLogin = await activeFixture.authenticate(
      target.email,
      acceptedPassword
    );
    const restrictedData = await request(activeFixture.app)
      .get("/api/categories")
      .set("Cookie", restrictedLogin.cookie);
    assert.equal(restrictedData.status, 403, restrictedData.text);
    assert.equal(errorCode(restrictedData), "PASSWORD_CHANGE_REQUIRED");
  });

  it("protects self and last-active-Administrator safety decisions", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);

    const selfDeactivation = await patchUser(
      activeFixture,
      adminSession,
      administratorId,
      { isActive: false }
    );
    assert.equal(selfDeactivation.status, 409, selfDeactivation.text);
    assert.equal(errorCode(selfDeactivation), "SELF_DEACTIVATION");

    const selfDemotion = await patchUser(
      activeFixture,
      adminSession,
      administratorId,
      { role: "IT Staff" }
    );
    assert.equal(selfDemotion.status, 409, selfDemotion.text);
    assert.equal(errorCode(selfDemotion), "LAST_ADMIN_REQUIRED");

    const otherAdministrator = await createUser(activeFixture, {
      displayName: "Second Administrator",
      email: secondAdminEmail,
      role: "Administrator",
    });
    const demoted = await patchUser(
      activeFixture,
      adminSession,
      administratorId,
      { role: "IT Staff" }
    );
    assert.equal(demoted.status, 200, demoted.text);
    assert.equal(responseUser(demoted).role, "IT Staff");

    const remaining = await activeFixture.prisma.user.findUnique({
      select: { isActive: true, role: true },
      where: { id: otherAdministrator.id },
    });
    assert.deepEqual(remaining, { isActive: true, role: "Administrator" });
  });

  it("serializes concurrent self-demotions so one active Administrator remains", async () => {
    const activeFixture = getFixture();
    const secondAdministrator = await createUser(activeFixture, {
      displayName: "Concurrent Administrator",
      email: secondAdminEmail,
      role: "Administrator",
    });
    const firstSession = await activeFixture.authenticate(adminEmail);
    const secondSession = await activeFixture.authenticate(secondAdminEmail);

    const responses = await Promise.all([
      patchUser(activeFixture, firstSession, administratorId, {
        role: "IT Staff",
      }),
      patchUser(activeFixture, secondSession, secondAdministrator.id, {
        role: "IT Staff",
      }),
    ]);

    const statuses = responses.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 200).length, 1);
    assert.equal(statuses.filter((status) => status === 409).length, 1);
    assert.equal(
      statuses.some(
        (status, index) =>
          status === 409 &&
          errorCode(responses[index] ?? { body: {} }) === "LAST_ADMIN_REQUIRED"
      ),
      true
    );
    assert.equal(
      await activeFixture.prisma.user.count({
        where: { isActive: true, role: "Administrator" },
      }),
      1
    );
  });

  it("unassigns only nonterminal owned Tickets when eligibility is removed", async () => {
    const activeFixture = getFixture();
    const owner = await createUser(activeFixture, {
      displayName: "Ticket Owner",
      email: "ticket-owner@example.test",
      role: "IT Staff",
    });
    const requester = await createUser(activeFixture, {
      displayName: "Ticket Requester",
      email: "ticket-requester@example.test",
      role: "Requester",
    });
    const category = await activeFixture.prisma.category.create({
      data: { name: "Lifecycle Category" },
    });
    const relatedSystem = await activeFixture.prisma.relatedSystem.create({
      data: { name: "Lifecycle System" },
    });
    const openTicket = await activeFixture.prisma.ticket.create({
      data: {
        categoryId: category.id,
        currentStatus: "Open",
        description: "A ticket that remains in the active workflow.",
        itPriority: "High",
        ownerId: owner.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "High",
        requesterId: requester.id,
        summary: "Open owned ticket",
        ticketNumber: "TKT-20260916-OPEN01",
        version: 4,
      },
    });
    const closedTicket = await activeFixture.prisma.ticket.create({
      data: {
        categoryId: category.id,
        currentStatus: "Closed",
        description: "A terminal ticket keeps historical ownership.",
        itPriority: "Low",
        ownerId: owner.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: "Low",
        requesterId: requester.id,
        summary: "Closed owned ticket",
        ticketNumber: "TKT-20260916-CLOSE1",
        version: 7,
      },
    });
    const adminSession = await activeFixture.authenticate(adminEmail);

    const response = await patchUser(activeFixture, adminSession, owner.id, {
      role: "Requester",
    });
    assert.equal(response.status, 200, response.text);

    const [updatedOpen, retainedClosed] = await Promise.all([
      activeFixture.prisma.ticket.findUnique({ where: { id: openTicket.id } }),
      activeFixture.prisma.ticket.findUnique({
        where: { id: closedTicket.id },
      }),
    ]);
    assert.equal(updatedOpen?.ownerId, null);
    assert.equal(updatedOpen?.version, 5);
    assert.equal(updatedOpen?.requesterId, requester.id);
    assert.equal(retainedClosed?.ownerId, owner.id);
    assert.equal(retainedClosed?.version, 7);
    assert.equal(retainedClosed?.requesterId, requester.id);
  });

  it("revokes a self-reset session and clears the browser cookie", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);
    const response = await resetUserPassword(
      activeFixture,
      adminSession,
      administratorId,
      "self reset initial phrase"
    );

    assert.equal(response.status, 200, response.text);
    assert.equal(hasClearedSessionCookie(response), true);
    assert.equal(responseUser(response).mustChangePassword, true);

    const revoked = await request(activeFixture.app)
      .get("/api/auth/me")
      .set("Cookie", adminSession.cookie);
    assert.equal(revoked.status, 401, revoked.text);
    assert.equal(
      await activeFixture.prisma.session.count({
        where: { userId: administratorId },
      }),
      0
    );
  });

  it("requires CSRF and origin protection for edit and reset mutations", async () => {
    const activeFixture = getFixture();
    const target = await createUser(activeFixture, {
      displayName: "Protected Target",
      email: "protected-target@example.test",
      role: "Requester",
    });
    const adminSession = await activeFixture.authenticate(adminEmail);

    const noCsrf = await request(activeFixture.app)
      .patch(`/api/users/${target.id}`)
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", adminSession.cookie)
      .send({ displayName: "No CSRF" });
    assert.equal(noCsrf.status, 403, noCsrf.text);
    assert.equal(errorCode(noCsrf), "CSRF_INVALID");

    const wrongOrigin = await request(activeFixture.app)
      .post(`/api/users/${target.id}/initial-password`)
      .set("Origin", "https://untrusted.example")
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({ confirmed: true, initialPassword: "another reset phrase" });
    assert.equal(wrongOrigin.status, 403, wrongOrigin.text);
    assert.equal(errorCode(wrongOrigin), "ORIGIN_FORBIDDEN");
  });
});
