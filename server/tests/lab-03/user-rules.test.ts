import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/errors/api-error.js";
import {
  parseUserListQuery,
  validateCreateUser,
} from "../../src/services/user-rules.js";

describe("Lab 3 user-management rules", () => {
  it("normalizes safe account fields while preserving the initial password", () => {
    const input = validateCreateUser({
      displayName: "  Ada Administrator  ",
      email: " Ada@Example.TEST ",
      initialPassword: " pass phrase with spaces ",
      isActive: false,
      role: "Administrator",
    });

    expect(input).toEqual({
      displayName: "Ada Administrator",
      email: "ada@example.test",
      initialPassword: " pass phrase with spaces ",
      isActive: false,
      role: "Administrator",
    });
  });

  it("rejects unknown fields, invalid roles, and boundary-breaking names", () => {
    expect(() =>
      validateCreateUser({
        displayName: "Valid Name",
        email: "valid@example.test",
        initialPassword: "valid passphrase here",
        isActive: true,
        password: "secret",
        role: "Requester",
      })
    ).toThrow(ApiError);

    expect(() =>
      validateCreateUser({
        displayName: "Valid Name",
        email: "valid@example.test",
        initialPassword: "valid passphrase here",
        isActive: true,
        role: ["Requester"],
      })
    ).toThrow(ApiError);

    expect(() =>
      validateCreateUser({
        displayName: "😀".repeat(101),
        email: "valid@example.test",
        initialPassword: "valid passphrase here",
        isActive: true,
        role: "Requester",
      })
    ).toThrow(ApiError);
  });

  it("trims search and maps the wire role label to the persistence role", () => {
    expect(parseUserListQuery({ role: "IT Staff", search: "  ada " })).toEqual({
      role: "ITStaff",
      search: "ada",
    });
    expect(parseUserListQuery({ search: "   " })).toEqual({});
  });

  it("rejects repeated, unknown, and overlong query values", () => {
    expect(() => parseUserListQuery({ search: ["ada", "ben"] })).toThrow(
      ApiError
    );
    expect(() => parseUserListQuery({ status: "active" })).toThrow(ApiError);
    expect(() => parseUserListQuery({ search: "a".repeat(201) })).toThrow(
      ApiError
    );
  });
});
