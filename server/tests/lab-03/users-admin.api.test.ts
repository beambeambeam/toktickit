import assert from "node:assert/strict";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  createUsersAdminFixture,
  TEST_ORIGIN,
  TEST_PASSWORD,
} from "../helpers/users-admin-fixture.js";
import type { UsersAdminFixture } from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;

const adminEmail = "api-admin@example.test";
const requesterEmail = "api-requester@example.test";
const staffEmail = "api-staff@example.test";

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

const userFromResponse = (response: { body: unknown }): JsonObject => {
  const body = asJsonObject(response.body);
  return asJsonObject(body.user);
};

describe("Lab 3 administrator user endpoints", () => {
  let fixture: UsersAdminFixture | undefined;

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
    await activeFixture.createUser({
      displayName: "Api Administrator",
      email: adminEmail,
      role: "Administrator",
    });
    await activeFixture.createUser({
      displayName: "Api Requester",
      email: requesterEmail,
      role: "Requester",
    });
    await activeFixture.createUser({
      displayName: "Api IT Staff",
      email: staffEmail,
      role: "ITStaff",
    });
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it("allows an Administrator to list users and create one without secrets", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);

    const listResponse = await request(activeFixture.app)
      .get("/api/users")
      .set("Cookie", adminSession.cookie);
    assert.equal(listResponse.status, 200, listResponse.text);
    const listBody = asJsonObject(listResponse.body);
    const listedUsers = listBody.items;
    assert.ok(Array.isArray(listedUsers));
    assert.deepEqual(
      listedUsers.map((user: unknown) => asJsonObject(user).email),
      [adminEmail, staffEmail, requesterEmail]
    );
    assert.equal(JSON.stringify(listBody).includes("passwordHash"), false);

    const initialPassword = "new account initial passphrase";
    const createResponse = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({
        displayName: "  Created Staff  ",
        email: "Created.Staff@Example.TEST",
        initialPassword,
        isActive: true,
        role: "IT Staff",
      });
    assert.equal(createResponse.status, 201, createResponse.text);
    const createdUser = userFromResponse(createResponse);
    assert.equal(createdUser.displayName, "Created Staff");
    assert.equal(createdUser.email, "created.staff@example.test");
    assert.equal(createdUser.role, "IT Staff");
    assert.equal(createdUser.isActive, true);
    assert.equal(createdUser.mustChangePassword, true);
    assert.equal("passwordHash" in createdUser, false);
    assert.equal(
      JSON.stringify(createResponse.body).includes(initialPassword),
      false
    );

    const storedUser = await activeFixture.prisma.user.findUnique({
      where: { email: "created.staff@example.test" },
    });
    assert.notEqual(storedUser, null);
    assert.notEqual(storedUser?.passwordHash, initialPassword);
    assert.match(storedUser?.passwordHash ?? "", /^\$argon2id\$/u);
  });

  it("rejects GET and POST without a session", async () => {
    const activeFixture = getFixture();

    const getResponse = await request(activeFixture.app).get("/api/users");
    assert.equal(getResponse.status, 401, getResponse.text);
    assert.equal(errorCode(getResponse), "AUTHENTICATION_REQUIRED");

    const postResponse = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .send({
        displayName: "Unauthenticated User",
        email: "unauthenticated@example.test",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: "Requester",
      });
    assert.equal(postResponse.status, 401, postResponse.text);
    assert.equal(errorCode(postResponse), "AUTHENTICATION_REQUIRED");
  });

  it.each([
    { email: requesterEmail, role: "Requester" },
    { email: staffEmail, role: "IT Staff" },
  ])("rejects $role from both user operations", async ({ email }) => {
    const activeFixture = getFixture();
    const session = await activeFixture.authenticate(email);

    const getResponse = await request(activeFixture.app)
      .get("/api/users")
      .set("Cookie", session.cookie);
    assert.equal(getResponse.status, 403, getResponse.text);
    assert.equal(errorCode(getResponse), "FORBIDDEN");

    const postResponse = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({
        displayName: "Rejected User",
        email: "rejected@example.test",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: "Requester",
      });
    assert.equal(postResponse.status, 403, postResponse.text);
    assert.equal(errorCode(postResponse), "FORBIDDEN");
  });

  it("rejects a restricted Administrator session before user authorization", async () => {
    const activeFixture = getFixture();
    await activeFixture.prisma.user.update({
      data: { mustChangePassword: true },
      where: { email: adminEmail },
    });
    const session = await activeFixture.authenticate(adminEmail);

    const getResponse = await request(activeFixture.app)
      .get("/api/users")
      .set("Cookie", session.cookie);
    assert.equal(getResponse.status, 403, getResponse.text);
    assert.equal(errorCode(getResponse), "PASSWORD_CHANGE_REQUIRED");

    const postResponse = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({
        displayName: "Restricted User",
        email: "restricted@example.test",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: "Requester",
      });
    assert.equal(postResponse.status, 403, postResponse.text);
    assert.equal(errorCode(postResponse), "PASSWORD_CHANGE_REQUIRED");
  });

  it("rejects missing or wrong CSRF tokens and unapproved origins", async () => {
    const activeFixture = getFixture();
    const session = await activeFixture.authenticate(adminEmail);
    const body = {
      displayName: "Protected User",
      email: "protected@example.test",
      initialPassword: TEST_PASSWORD,
      isActive: true,
      role: "Requester",
    };

    const missingCsrf = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .send(body);
    assert.equal(missingCsrf.status, 403, missingCsrf.text);
    assert.equal(errorCode(missingCsrf), "CSRF_INVALID");

    const wrongCsrf = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", `${session.csrfToken}wrong`)
      .send(body);
    assert.equal(wrongCsrf.status, 403, wrongCsrf.text);
    assert.equal(errorCode(wrongCsrf), "CSRF_INVALID");

    const missingOrigin = await request(activeFixture.app)
      .post("/api/users")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send(body);
    assert.equal(missingOrigin.status, 403, missingOrigin.text);
    assert.equal(errorCode(missingOrigin), "ORIGIN_FORBIDDEN");

    const wrongOrigin = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", "https://untrusted.example")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send(body);
    assert.equal(wrongOrigin.status, 403, wrongOrigin.text);
    assert.equal(errorCode(wrongOrigin), "ORIGIN_FORBIDDEN");
  });

  it.each([
    {
      body: {
        displayName: "Invalid User",
        email: "invalid-property@example.test",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: "Requester",
        unexpected: true,
      },
      label: "unknown property",
    },
    {
      body: {
        displayName: "Invalid User",
        email: "invalid-role@example.test",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: ["Requester"],
      },
      label: "array role",
    },
    {
      body: {
        displayName: "Invalid User",
        email: "invalid-active@example.test",
        initialPassword: TEST_PASSWORD,
        isActive: "true",
        role: "Requester",
      },
      label: "non-boolean activation state",
    },
    {
      body: {
        displayName: "Invalid User",
        email: "invalid-password@example.test",
        initialPassword: "too short",
        isActive: true,
        role: "Requester",
      },
      label: "short initial password",
    },
  ])("rejects $label input", async ({ body }) => {
    const activeFixture = getFixture();
    const session = await activeFixture.authenticate(adminEmail);
    const response = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send(body);

    assert.equal(response.status, 400, response.text);
    assert.equal(errorCode(response), "VALIDATION_ERROR");
  });

  it("returns a safe conflict for a normalized duplicate email", async () => {
    const activeFixture = getFixture();
    const session = await activeFixture.authenticate(adminEmail);
    const firstResponse = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({
        displayName: "First Duplicate",
        email: "Duplicate.Email@Example.TEST",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: "Requester",
      });
    assert.equal(firstResponse.status, 201, firstResponse.text);

    const duplicateResponse = await request(activeFixture.app)
      .post("/api/users")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({
        displayName: "Second Duplicate",
        email: " duplicate.email@example.test ",
        initialPassword: TEST_PASSWORD,
        isActive: true,
        role: "Requester",
      });
    assert.equal(duplicateResponse.status, 409, duplicateResponse.text);
    assert.equal(errorCode(duplicateResponse), "EMAIL_CONFLICT");
    assert.equal(
      JSON.stringify(duplicateResponse.body).includes(TEST_PASSWORD),
      false
    );
  });
});
