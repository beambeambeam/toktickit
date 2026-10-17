import { describe, expect, it } from "vitest";

import { ApiError } from "../../src/errors/api-error.js";
import { parseStaffTicketListQuery } from "../../src/services/ticket-rules.js";

const expectValidationError = (input: Record<string, unknown>) => {
  expect(() => parseStaffTicketListQuery(input)).toThrow(ApiError);

  try {
    parseStaffTicketListQuery(input);
  } catch (error: unknown) {
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
  }
};

describe("staff dashboard Ticket scope rules", () => {
  it("parses the recently-updated scope with inclusive UTC bounds", () => {
    expect(
      parseStaffTicketListQuery({
        from: "2026-10-04T04:00:00Z",
        scope: "recently-updated",
        through: "2026-10-11T04:00:00Z",
      })
    ).toEqual({
      from: new Date("2026-10-04T04:00:00.000Z"),
      page: 1,
      pageSize: 20,
      scope: "recently-updated",
      sortBy: "updatedAt",
      sortDirection: "desc",
      through: new Date("2026-10-11T04:00:00.000Z"),
    });
  });

  it("parses the active and urgent-active scopes without time bounds", () => {
    expect(parseStaffTicketListQuery({ scope: "active" })).toEqual({
      page: 1,
      pageSize: 20,
      scope: "active",
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    expect(parseStaffTicketListQuery({ scope: "urgent-active" })).toEqual({
      page: 1,
      pageSize: 20,
      scope: "urgent-active",
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  });

  it("accepts equal from and through bounds", () => {
    expect(
      parseStaffTicketListQuery({
        from: "2026-10-11T04:00:00Z",
        scope: "recently-updated",
        through: "2026-10-11T04:00:00Z",
      })
    ).toMatchObject({
      from: new Date("2026-10-11T04:00:00.000Z"),
      through: new Date("2026-10-11T04:00:00.000Z"),
    });
  });

  it("rejects scopes that are not staff Ticket queue scopes", () => {
    expectValidationError({ scope: "unsupported" });
    expectValidationError({ scope: "waiting-for-requester" });
    expectValidationError({
      from: "2026-10-04T04:00:00Z",
      scope: "recently-resolved",
      through: "2026-10-11T04:00:00Z",
    });
  });

  it("requires from and through for the recently-updated scope", () => {
    expectValidationError({ scope: "recently-updated" });
    expectValidationError({
      from: "2026-10-04T04:00:00Z",
      scope: "recently-updated",
    });
    expectValidationError({
      scope: "recently-updated",
      through: "2026-10-11T04:00:00Z",
    });
  });

  it("rejects from later than through", () => {
    expectValidationError({
      from: "2026-10-11T04:00:00Z",
      scope: "recently-updated",
      through: "2026-10-04T04:00:00Z",
    });
  });

  it("rejects non-UTC and malformed time bounds", () => {
    expectValidationError({
      from: "2026-10-04T11:00:00+07:00",
      scope: "recently-updated",
      through: "2026-10-11T04:00:00Z",
    });
    expectValidationError({
      from: "2026-10-04",
      scope: "recently-updated",
      through: "2026-10-11T04:00:00Z",
    });
  });

  it("rejects from and through for scopes without a time window", () => {
    expectValidationError({
      from: "2026-10-04T04:00:00Z",
      scope: "active",
      through: "2026-10-11T04:00:00Z",
    });
    expectValidationError({
      from: "2026-10-04T04:00:00Z",
      through: "2026-10-11T04:00:00Z",
    });
    expectValidationError({
      scope: "urgent-active",
      through: "2026-10-11T04:00:00Z",
    });
  });

  it("rejects duplicate scope values", () => {
    expectValidationError({ scope: ["active", "urgent-active"] });
  });
});
