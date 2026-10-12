import { describe, expect, it } from "vitest";

import { parseTimeWindow } from "@/lib/ticket-search";
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
