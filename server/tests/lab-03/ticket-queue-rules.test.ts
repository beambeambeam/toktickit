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

describe("staff Ticket queue query rules", () => {
  it("uses the documented queue defaults", () => {
    expect(parseStaffTicketListQuery({})).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  });

  it("parses every queue filter and owner mode", () => {
    expect(
      parseStaffTicketListQuery({
        categoryId: "2",
        currentStatus: "In Progress",
        itPriority: "Urgent",
        owner: "me",
        page: "3",
        pageSize: "50",
        relatedSystemId: "4",
        requestedPriority: "High",
        search: "  outage%  ",
        sortBy: "itPriority",
        sortDirection: "asc",
      })
    ).toEqual({
      categoryId: 2,
      currentStatus: "In Progress",
      itPriority: "Urgent",
      owner: "me",
      page: 3,
      pageSize: 50,
      relatedSystemId: 4,
      requestedPriority: "High",
      search: "outage%",
      sortBy: "itPriority",
      sortDirection: "asc",
    });
  });

  it.each([
    { input: { page: ["1", "1"] } },
    { input: { owner: "0" } },
    { input: { page: "01" } },
    { input: { page: "2147483648" } },
    { input: { pageSize: "25" } },
    { input: { page: " " } },
    { input: { unknown: "value" } },
    { input: { currentStatus: "Pending" } },
    { input: { owner: { id: "42" } } },
  ])("rejects invalid query: $input", ({ input }) => {
    expectValidationError(input);
  });

  it("accepts a positive eligible owner identifier without coercing it to a string", () => {
    expect(parseStaffTicketListQuery({ owner: "42" }).owner).toBe(42);
  });

  it("trims search before applying the length limit", () => {
    const search = `  ${"x".repeat(200)}  `;

    expect(parseStaffTicketListQuery({ search })).toMatchObject({
      search: "x".repeat(200),
    });
    expectValidationError({ search: `  ${"x".repeat(201)}  ` });
  });
});
