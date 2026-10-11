import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  isActiveTicketStatus,
  isWithinInclusiveWindow,
} from "../../src/services/dashboard-rules.js";

describe("Lab 4 dashboard rules", () => {
  it("counts only the approved active Ticket statuses", () => {
    for (const status of [
      "New",
      "Open",
      "In Progress",
      "Waiting for Requester",
      "Reopened",
    ] as const) {
      assert.equal(isActiveTicketStatus(status), true, `${status} is active`);
    }

    for (const status of ["Resolved", "Closed", "Cancelled"] as const) {
      assert.equal(
        isActiveTicketStatus(status),
        false,
        `${status} is terminal`
      );
    }
  });

  it("includes both UTC endpoints in a dashboard time window", () => {
    const from = new Date("2026-10-04T04:00:00.000Z");
    const through = new Date("2026-10-11T04:00:00.000Z");

    assert.equal(isWithinInclusiveWindow(from, from, through), true);
    assert.equal(isWithinInclusiveWindow(through, from, through), true);
    assert.equal(
      isWithinInclusiveWindow(
        new Date("2026-10-04T03:59:59.999Z"),
        from,
        through
      ),
      false
    );
    assert.equal(
      isWithinInclusiveWindow(
        new Date("2026-10-11T04:00:00.001Z"),
        from,
        through
      ),
      false
    );
  });
});
