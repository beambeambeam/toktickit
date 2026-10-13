import { describe, expect, it } from "vitest";

import { parseTimeWindow } from "@/lib/ticket-search";
import { Route as StaffTicketsRoute } from "@/routes/staff/tickets/index";
import { Route } from "@/routes/tickets/index";

describe("Ticket search time window", () => {
  it("keeps a valid UTC window", () => {
    const window = {
      from: "2026-09-01T00:00:00.000Z",
      through: "2026-09-08T00:00:00Z",
    };
    expect(parseTimeWindow(window.from, window.through)).toEqual(window);
  });

  it.each([
    ["bad", "2026-09-08T00:00:00.000Z"],
    ["2026-09-01T00:00:00.000Z", "bad"],
    ["2026-09-01", "2026-09-08"],
    ["2026-02-31T00:00:00.000Z", "2026-09-08T00:00:00.000Z"],
    ["2026-09-09T00:00:00.000Z", "2026-09-08T00:00:00.000Z"],
    ["2026-09-01T00:00:00+07:00", "2026-09-08T00:00:00.000Z"],
    [undefined, "2026-09-08T00:00:00.000Z"],
  ])("drops the pair for from=%s through=%s", (from, through) => {
    expect(parseTimeWindow(from, through)).toBeUndefined();
  });

  it("drops a malformed window from the Tickets route search", () => {
    const { validateSearch } = Route.options;
    if (typeof validateSearch !== "function") {
      throw new TypeError("validateSearch must be a function");
    }
    expect(
      validateSearch({ from: "bad", scope: "recently-updated", through: "bad" })
    ).toEqual({ scope: "recently-updated" });
  });
});

const validateStaffSearch = (search: Record<string, unknown>) => {
  const { validateSearch } = StaffTicketsRoute.options;
  if (typeof validateSearch !== "function") {
    throw new TypeError("validateSearch must be a function");
  }
  return validateSearch(search);
};

describe("Staff Ticket Queue search", () => {
  it("keeps scope, owner, status, and priority from the URL", () => {
    expect(
      validateStaffSearch({
        currentStatus: "Open",
        itPriority: "Urgent",
        owner: "me",
        scope: "urgent-active",
      })
    ).toEqual({
      currentStatus: "Open",
      itPriority: "Urgent",
      owner: "me",
      scope: "urgent-active",
    });
  });

  it("keeps a numeric owner and the unassigned owner", () => {
    expect(validateStaffSearch({ owner: 7 })).toEqual({ owner: 7 });
    expect(validateStaffSearch({ owner: "unassigned" })).toEqual({
      owner: "unassigned",
    });
  });

  it("keeps a valid recently-updated window", () => {
    expect(
      validateStaffSearch({
        from: "2026-09-01T00:00:00.000Z",
        scope: "recently-updated",
        through: "2026-09-08T00:00:00.000Z",
      })
    ).toEqual({
      from: "2026-09-01T00:00:00.000Z",
      scope: "recently-updated",
      through: "2026-09-08T00:00:00.000Z",
    });
  });

  it("drops recently-updated scope when its window is malformed", () => {
    expect(
      validateStaffSearch({
        from: "bad",
        scope: "recently-updated",
        through: "2026-09-08T00:00:00.000Z",
      })
    ).toEqual({});
  });

  it("drops unknown scope, owner, status, and priority values", () => {
    expect(
      validateStaffSearch({
        currentStatus: "Unknown",
        itPriority: "Panic",
        owner: "someone",
        scope: "everything",
      })
    ).toEqual({});
  });

  it("drops a time window that has no time scope", () => {
    expect(
      validateStaffSearch({
        from: "2026-09-01T00:00:00.000Z",
        scope: "active",
        through: "2026-09-08T00:00:00.000Z",
      })
    ).toEqual({ scope: "active" });
  });
});
