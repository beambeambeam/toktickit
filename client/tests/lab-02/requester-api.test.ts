/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { changePassword, login, logout } from "@/api/auth";
import { clearCsrfToken, setCsrfToken } from "@/api/client";
import { ApiRequestError, getTickets } from "@/api/requester";

const listParams = {
  page: 1,
  pageSize: 10 as const,
  sortBy: "updatedAt" as const,
  sortDirection: "desc" as const,
};

describe("requester Ticket API adapters", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.unstubAllGlobals();
  });

  it("rejects a malformed Ticket-list response with a safe API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] }))
    );

    await expect(getTickets(listParams)).rejects.toMatchObject({
      constructor: ApiRequestError,
      message: "The API returned an invalid Ticket-list response.",
      status: 500,
    });
  });

  it("uses cookie credentials and the in-memory CSRF token for auth mutations", async () => {
    const authResponse = {
      csrfToken: "csrf-token",
      user: {
        createdAt: "2026-09-01T00:00:00.000Z",
        displayName: "Ada Requester",
        email: "ada@example.test",
        id: 1,
        isActive: true,
        mustChangePassword: false,
        role: "Requester" as const,
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(authResponse))
      .mockResolvedValueOnce(Response.json(authResponse))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    setCsrfToken("stale-token");
    await login({ email: "ada@example.test", password: "valid passphrase" });
    await changePassword({
      currentPassword: "valid passphrase",
      newPassword: "another valid passphrase",
    });
    await logout();

    const loginRequest = fetchMock.mock.calls[0]?.[0];
    const changeRequest = fetchMock.mock.calls[1]?.[0];
    const logoutRequest = fetchMock.mock.calls[2]?.[0];
    for (const request of [loginRequest, changeRequest, logoutRequest]) {
      if (!(request instanceof Request)) {
        throw new Error("Expected the API client to pass a Request.");
      }
      expect(request.credentials).toBe("include");
    }
    if (
      !(loginRequest instanceof Request) ||
      !(changeRequest instanceof Request)
    ) {
      throw new Error("Expected auth requests to be Request objects.");
    }
    expect(loginRequest.headers.has("X-CSRF-Token")).toBe(false);
    expect(changeRequest.headers.get("X-CSRF-Token")).toBe("csrf-token");
  });
});
