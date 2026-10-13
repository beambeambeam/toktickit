import { describe, expect, it } from "vitest";

import {
  getResolutionGateReasons,
  isCancellationBlockedByActions,
} from "../../src/types/ticket-workflow.js";

const eligibleOwner = { isActive: true, role: "ITStaff" } as const;
const satisfiedGate = {
  completedActionCount: 1,
  owner: eligibleOwner,
  pendingActionCount: 0,
};

describe("Ticket resolution gate rules", () => {
  it("passes when an active eligible owner has a Completed action and no pending work", () => {
    expect(getResolutionGateReasons(satisfiedGate)).toEqual([]);
  });

  it("accepts an active Administrator owner", () => {
    expect(
      getResolutionGateReasons({
        ...satisfiedGate,
        owner: { isActive: true, role: "Administrator" },
      })
    ).toEqual([]);
  });

  it("reports a missing owner as OWNER_REQUIRED", () => {
    expect(getResolutionGateReasons({ ...satisfiedGate, owner: null })).toEqual(
      ["OWNER_REQUIRED"]
    );
  });

  it("reports an inactive owner as OWNER_INELIGIBLE", () => {
    expect(
      getResolutionGateReasons({
        ...satisfiedGate,
        owner: { isActive: false, role: "ITStaff" },
      })
    ).toEqual(["OWNER_INELIGIBLE"]);
  });

  it("reports a Requester owner as OWNER_INELIGIBLE", () => {
    expect(
      getResolutionGateReasons({
        ...satisfiedGate,
        owner: { isActive: true, role: "Requester" },
      })
    ).toEqual(["OWNER_INELIGIBLE"]);
  });

  it("reports Planned or In Progress actions as PENDING_ACTIONS", () => {
    expect(
      getResolutionGateReasons({ ...satisfiedGate, pendingActionCount: 2 })
    ).toEqual(["PENDING_ACTIONS"]);
  });

  it("reports zero Completed actions as NO_COMPLETED_ACTION", () => {
    expect(
      getResolutionGateReasons({ ...satisfiedGate, completedActionCount: 0 })
    ).toEqual(["NO_COMPLETED_ACTION"]);
  });

  it("lists every unmet reason in the fixed order", () => {
    expect(
      getResolutionGateReasons({
        completedActionCount: 0,
        owner: null,
        pendingActionCount: 1,
      })
    ).toEqual(["OWNER_REQUIRED", "PENDING_ACTIONS", "NO_COMPLETED_ACTION"]);
  });

  it("orders an ineligible owner before pending actions", () => {
    expect(
      getResolutionGateReasons({
        completedActionCount: 1,
        owner: { isActive: false, role: "Administrator" },
        pendingActionCount: 1,
      })
    ).toEqual(["OWNER_INELIGIBLE", "PENDING_ACTIONS"]);
  });
});

describe("Ticket cancellation gate rules", () => {
  it("allows cancellation when no Planned or In Progress action remains", () => {
    expect(isCancellationBlockedByActions(0)).toBe(false);
  });

  it("blocks cancellation while any Planned or In Progress action remains", () => {
    expect(isCancellationBlockedByActions(1)).toBe(true);
  });
});
