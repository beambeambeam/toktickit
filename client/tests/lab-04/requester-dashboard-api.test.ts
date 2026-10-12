/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { clearCsrfToken } from "@/api/client";
import { requesterDashboardQueryOptions } from "@/api/dashboard-query-options";
import { ApiRequestError } from "@/api/errors";
import { getRequesterDashboard } from "@/api/requester-dashboard";
import type { RequesterDashboardResponse } from "@/generated/hey-api/types.gen";

const dashboard: RequesterDashboardResponse = {
  counts: {
    activeTickets: 2,
    recentlyResolved: 1,
    recentlyUpdated: 1,
    waitingForRequester: 1,
  },
  generatedAt: "2026-10-11T04:00:00.000Z",
  previews: {
    recentlyResolved: [],
    recentlyUpdated: [
      {
        currentStatus: "Open",
        id: 21,
        requestedPriority: "High",
        resolvedAt: null,
        summary: "Campus Wi-Fi login issue",
        ticketNumber: "TKT-20261010-ABC123",
        updatedAt: "2026-10-10T04:00:00.000Z",
      },
    ],
  },
  window: {
    from: "2026-10-04T04:00:00.000Z",
    through: "2026-10-11T04:00:00.000Z",
  },
};

describe("Requester dashboard API adapter", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("loads the authenticated dashboard without accepting a client requester scope", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(dashboard));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRequesterDashboard()).resolves.toEqual(dashboard);
    const request = fetchMock.mock.calls[0]?.[0];
    if (!(request instanceof Request)) {
      throw new Error("Expected the API client to pass a Request.");
    }
    const url = new URL(request.url);
    expect(url.pathname).toBe("/api/requester/dashboard");
    expect(url.search).toBe("");
    expect(request.credentials).toBe("include");
  });

  it("rejects an incomplete dashboard response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ counts: {}, previews: [], window: {} })
        )
    );

    await expect(getRequesterDashboard()).rejects.toMatchObject({
      constructor: ApiRequestError,
      message: "The API returned an invalid Requester dashboard response.",
      status: 500,
    });
  });

  it("isolates dashboard cache keys by account and role", () => {
    const first = requesterDashboardQueryOptions(12, "Requester");
    const anotherAccount = requesterDashboardQueryOptions(18, "Requester");
    const anotherRole = requesterDashboardQueryOptions(12, "IT Staff");

    expect(first.queryKey).toEqual(["requester-dashboard", 12, "Requester"]);
    expect(first.queryKey).not.toEqual(anotherAccount.queryKey);
    expect(first.queryKey).not.toEqual(anotherRole.queryKey);
  });
});
