/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, getTickets } from "@/api/requester";

const listParams = {
  page: 1,
  pageSize: 10 as const,
  sortBy: "updatedAt" as const,
  sortDirection: "desc" as const,
};

describe("requester Ticket API adapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a malformed Ticket-list response with a safe API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] }))
    );

    await expect(getTickets(1, listParams)).rejects.toMatchObject({
      constructor: ApiRequestError,
      message: "The API returned an invalid Ticket-list response.",
      status: 500,
    });
  });
});
