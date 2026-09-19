import { describe, expect, it } from "vitest";

import { currentStatuses } from "../../src/services/ticket-rules.js";
import {
  allowedNextStatuses,
  isAllowedStatusTransition,
  statusRequiresConfirmation,
  statusRequiresEligibleOwner,
} from "../../src/types/ticket-workflow.js";

describe("Ticket status workflow rules", () => {
  it("allows exactly the documented status matrix edges", () => {
    for (const currentStatus of currentStatuses) {
      for (const nextStatus of currentStatuses) {
        expect(
          isAllowedStatusTransition(currentStatus, nextStatus),
          `${currentStatus} -> ${nextStatus}`
        ).toBe(allowedNextStatuses[currentStatus].includes(nextStatus));
      }
    }
  });

  it("requires an eligible owner only for In Progress and Resolved", () => {
    expect(currentStatuses.filter(statusRequiresEligibleOwner)).toEqual([
      "In Progress",
      "Resolved",
    ]);
  });

  it("requires confirmation for terminal destinations", () => {
    expect(currentStatuses.filter(statusRequiresConfirmation)).toEqual([
      "Resolved",
      "Closed",
      "Cancelled",
    ]);
  });
});
