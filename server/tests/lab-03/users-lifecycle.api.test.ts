import assert from "node:assert/strict";

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  createUsersAdminFixture,
  TEST_ORIGIN,
  TEST_PASSWORD,
} from "../helpers/users-admin-fixture.js";
import type {
  AuthenticatedFixtureSession,
  UsersAdminFixture,
} from "../helpers/users-admin-fixture.js";

type JsonObject = Record<string, unknown>;
type UserRoleLabel = "Requester" | "IT Staff" | "Administrator";

const adminEmail = "lifecycle-admin@example.test";

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

const createUserBody = ({
  displayName,
  email,
  initialPassword = TEST_PASSWORD,
  isActive = true,
  role = "Requester",
}: {
  displayName: string;
  email: string;
  initialPassword?: string;
  isActive?: boolean;
  role?: UserRoleLabel;
}) => ({
  displayName,
  email,
  initialPassword,
  isActive,
  role,
});

const createUser = async (
  fixture: UsersAdminFixture,
  session: AuthenticatedFixtureSession,
  body: ReturnType<typeof createUserBody>
) =>
  await request(fixture.app)
    .post("/api/users")
    .set("Origin", TEST_ORIGIN)
    .set("Cookie", session.cookie)
    .set("X-CSRF-Token", session.csrfToken)
    .send(body);

const expectCreatedUser = async (
  fixture: UsersAdminFixture,
  session: AuthenticatedFixtureSession,
  body: ReturnType<typeof createUserBody>
): Promise<void> => {
  const response = await createUser(fixture, session, body);
  assert.equal(response.status, 201, response.text);
};

const getUserEmails = (response: { body: unknown }): string[] => {
  const { items } = asJsonObject(response.body);

  if (!Array.isArray(items)) {
    throw new TypeError("Expected a user list.");
  }

  return items.map((item: unknown) => {
    const { email } = asJsonObject(item);
    if (typeof email !== "string") {
      throw new TypeError("Expected a user email.");
    }

    return email;
  });
};

describe("Lab 3 user account lifecycle", () => {
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
      displayName: "Lifecycle Administrator",
      email: adminEmail,
      role: "Administrator",
    });
  });

  afterAll(async () => {
    await fixture?.teardown();
  });

  it.each([
    { label: "unknown parameter", query: { page: "1" } },
    { label: "invalid role", query: { role: "Owner" } },
    { label: "multiple roles", query: { role: ["Requester", "IT Staff"] } },
    { label: "multiple searches", query: { search: ["first", "second"] } },
    { label: "overlong search", query: { search: "😀".repeat(201) } },
  ])("rejects $label list queries", async ({ query }) => {
    const activeFixture = getFixture();
    const session = await activeFixture.authenticate(adminEmail);
    const response = await request(activeFixture.app)
      .get("/api/users")
      .query(query)
      .set("Cookie", session.cookie);
    assert.equal(response.status, 400, response.text);
    assert.equal(errorCode(response), "VALIDATION_ERROR");
  });

  it("accepts blank and maximum-length search boundaries", async () => {
    const activeFixture = getFixture();
    const session = await activeFixture.authenticate(adminEmail);
    const blank = await request(activeFixture.app)
      .get("/api/users")
      .query({ search: "   " })
      .set("Cookie", session.cookie);
    assert.equal(blank.status, 200, blank.text);
    assert.deepEqual(getUserEmails(blank), [adminEmail]);
    const maximum = await request(activeFixture.app)
      .get("/api/users")
      .query({ search: "😀".repeat(200) })
      .set("Cookie", session.cookie);
    assert.equal(maximum.status, 200, maximum.text);
    assert.deepEqual(getUserEmails(maximum), []);
  });

  it("allows only one winner for concurrent mixed-case duplicate creates", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);
    const emails = [
      "Race.User@Example.TEST",
      "race.user@example.test",
      " RACE.USER@example.test ",
      "race.user@EXAMPLE.test",
    ];

    const responses = await Promise.all(
      emails.map(
        async (email) =>
          await createUser(
            activeFixture,
            adminSession,
            createUserBody({
              displayName: `Race ${email}`,
              email,
            })
          )
      )
    );

    const statuses = responses.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 1);
    assert.equal(statuses.filter((status) => status === 409).length, 3);
    assert.equal(
      statuses.every((status) => status === 201 || status === 409),
      true
    );
    for (const response of responses) {
      if (response.status === 409) {
        assert.equal(errorCode(response), "EMAIL_CONFLICT");
      }
    }

    const createdUsers = await activeFixture.prisma.user.findMany({
      select: { email: true },
      where: { email: "race.user@example.test" },
    });
    assert.deepEqual(createdUsers, [{ email: "race.user@example.test" }]);
  });

  it("searches case-insensitively, treats wildcard characters literally, and combines role filters", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);
    await expectCreatedUser(
      activeFixture,
      adminSession,
      createUserBody({
        displayName: "MixedCase Search Staff",
        email: "MixedCase.Search@example.test",
        role: "IT Staff",
      })
    );
    await expectCreatedUser(
      activeFixture,
      adminSession,
      createUserBody({
        displayName: "Percent % Candidate",
        email: "literal.percent%user@example.test",
      })
    );
    await expectCreatedUser(
      activeFixture,
      adminSession,
      createUserBody({
        displayName: "Underscore _ Candidate",
        email: "literal_under@example.test",
      })
    );
    await expectCreatedUser(
      activeFixture,
      adminSession,
      createUserBody({
        displayName: "Unrelated Requester",
        email: "unrelated@example.test",
      })
    );

    const caseInsensitive = await request(activeFixture.app)
      .get("/api/users")
      .query({ search: "MIXEDCASE.SEARCH" })
      .set("Cookie", adminSession.cookie);
    assert.equal(caseInsensitive.status, 200, caseInsensitive.text);
    assert.deepEqual(getUserEmails(caseInsensitive), [
      "mixedcase.search@example.test",
    ]);

    const nameMatch = await request(activeFixture.app)
      .get("/api/users")
      .query({ search: "mixedcase search" })
      .set("Cookie", adminSession.cookie);
    assert.equal(nameMatch.status, 200, nameMatch.text);
    assert.deepEqual(getUserEmails(nameMatch), [
      "mixedcase.search@example.test",
    ]);

    const excludedRole = await request(activeFixture.app)
      .get("/api/users")
      .query({ role: "Administrator", search: "search" })
      .set("Cookie", adminSession.cookie);
    assert.equal(excludedRole.status, 200, excludedRole.text);
    assert.deepEqual(getUserEmails(excludedRole), []);

    const percentLiteral = await request(activeFixture.app)
      .get("/api/users")
      .query({ search: "%" })
      .set("Cookie", adminSession.cookie);
    assert.equal(percentLiteral.status, 200, percentLiteral.text);
    assert.deepEqual(getUserEmails(percentLiteral), [
      "literal.percent%user@example.test",
    ]);

    const underscoreLiteral = await request(activeFixture.app)
      .get("/api/users")
      .query({ search: "_" })
      .set("Cookie", adminSession.cookie);
    assert.equal(underscoreLiteral.status, 200, underscoreLiteral.text);
    assert.deepEqual(getUserEmails(underscoreLiteral), [
      "literal_under@example.test",
    ]);

    const combinedFilter = await request(activeFixture.app)
      .get("/api/users")
      .query({ role: "IT Staff", search: "search" })
      .set("Cookie", adminSession.cookie);
    assert.equal(combinedFilter.status, 200, combinedFilter.text);
    assert.deepEqual(getUserEmails(combinedFilter), [
      "mixedcase.search@example.test",
    ]);
  });

  it("makes an active created account change its restricted first-login session", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);
    const email = "created-first-login@example.test";
    const initialPassword = "created account initial phrase";
    const replacementPassword = "created account replacement phrase";
    const createResponse = await createUser(
      activeFixture,
      adminSession,
      createUserBody({
        displayName: "Created First Login",
        email,
        initialPassword,
      })
    );
    assert.equal(createResponse.status, 201, createResponse.text);

    const firstLogin = await activeFixture.authenticate(email, initialPassword);
    const firstLoginUser = asJsonObject(
      asJsonObject(firstLogin.response.body).user
    );
    assert.equal(firstLoginUser.mustChangePassword, true);
    const restrictedDataResponse = await request(activeFixture.app)
      .get("/api/categories")
      .set("Cookie", firstLogin.cookie);
    assert.equal(
      restrictedDataResponse.status,
      403,
      restrictedDataResponse.text
    );
    assert.equal(errorCode(restrictedDataResponse), "PASSWORD_CHANGE_REQUIRED");

    const changed = await request(activeFixture.app)
      .post("/api/auth/change-password")
      .set("Origin", TEST_ORIGIN)
      .set("Cookie", firstLogin.cookie)
      .set("X-CSRF-Token", firstLogin.csrfToken)
      .send({
        currentPassword: initialPassword,
        newPassword: replacementPassword,
      });
    assert.equal(changed.status, 200, changed.text);
    const changedUser = asJsonObject(asJsonObject(changed.body).user);
    assert.equal(changedUser.mustChangePassword, false);

    const [newSessionCookie] = changed.headers["set-cookie"] ?? [];
    assert.ok(newSessionCookie !== undefined);
    const newCookie = newSessionCookie.split(";")[0] ?? "";
    const oldSessionResponse = await request(activeFixture.app)
      .get("/api/auth/me")
      .set("Cookie", firstLogin.cookie);
    assert.equal(oldSessionResponse.status, 401, oldSessionResponse.text);

    const unlockedDataResponse = await request(activeFixture.app)
      .get("/api/categories")
      .set("Cookie", newCookie);
    assert.equal(unlockedDataResponse.status, 200, unlockedDataResponse.text);

    const newPasswordLogin = await activeFixture.authenticate(
      email,
      replacementPassword
    );
    assert.equal(newPasswordLogin.response.status, 200);
  });

  it("refuses login for a created inactive account without issuing a session", async () => {
    const activeFixture = getFixture();
    const adminSession = await activeFixture.authenticate(adminEmail);
    const email = "created-inactive@example.test";
    const createResponse = await createUser(
      activeFixture,
      adminSession,
      createUserBody({
        displayName: "Created Inactive",
        email,
        isActive: false,
      })
    );
    assert.equal(createResponse.status, 201, createResponse.text);

    const loginResponse = await request(activeFixture.app)
      .post("/api/auth/login")
      .set("Origin", TEST_ORIGIN)
      .send({ email, password: TEST_PASSWORD });
    assert.equal(loginResponse.status, 403, loginResponse.text);
    assert.equal(errorCode(loginResponse), "ACCOUNT_INACTIVE");
    const setCookieHeaders: unknown = loginResponse.headers["set-cookie"];
    assert.equal(
      Array.isArray(setCookieHeaders) &&
        setCookieHeaders.some(
          (cookie: unknown) =>
            typeof cookie === "string" &&
            cookie.startsWith("toktickit_session=")
        ),
      false
    );

    const createdUser = await activeFixture.prisma.user.findUnique({
      select: { id: true },
      where: { email },
    });
    assert.ok(createdUser !== null);
    assert.equal(
      await activeFixture.prisma.session.count({
        where: { userId: createdUser.id },
      }),
      0
    );
  });
});
