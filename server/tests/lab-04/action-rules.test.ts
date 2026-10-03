import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ApiError } from "../../src/errors/api-error.js";
import {
  parseActionListQuery,
  validateCreateActionInput,
} from "../../src/services/action-rules.js";

const requestId = "a5726990-c560-45d5-ae76-2f75659bb540";

const assertValidationError = async (
  operation: () => unknown
): Promise<void> => {
  let caught: unknown;

  try {
    await operation();
  } catch (error: unknown) {
    caught = error;
  }

  assert.ok(caught instanceof ApiError);
  assert.equal(caught.code, "VALIDATION_ERROR");
};

const validCreateBody = () => ({
  assigneeId: 9,
  attachmentNotes: "  See the existing cable photo.  ",
  description: "  Replace the damaged network cable.\nTest both ports.  ",
  followUpNote: "  Confirm connectivity with the requester.  ",
  followUpRequired: true,
  requestId,
  result: "  Cable replaced.  ",
  version: 7,
});

describe("Action Taken request rules", () => {
  it("normalizes edge whitespace and preserves the supported fields", () => {
    assert.deepEqual(validateCreateActionInput(validCreateBody()), {
      assigneeId: 9,
      attachmentNotes: "See the existing cable photo.",
      description: "Replace the damaged network cable.\nTest both ports.",
      followUpNote: "Confirm connectivity with the requester.",
      followUpRequired: true,
      requestId,
      result: "Cable replaced.",
      version: 7,
    });
  });

  it("normalizes omitted and blank optional values to null/defaults", () => {
    assert.deepEqual(
      validateCreateActionInput({
        description: "Do the work.",
        followUpNote: "   ",
        followUpRequired: false,
        requestId,
        result: "\n\t",
        version: 1,
      }),
      {
        assigneeId: null,
        attachmentNotes: null,
        description: "Do the work.",
        followUpNote: null,
        followUpRequired: false,
        requestId,
        result: null,
        version: 1,
      }
    );
  });

  it("counts Unicode code points instead of UTF-16 code units", async () => {
    const accepted = validateCreateActionInput({
      description: `😀`.repeat(5000),
      followUpRequired: false,
      requestId,
      version: 1,
    });

    assert.equal(accepted.description, `😀`.repeat(5000));

    await assertValidationError(() =>
      validateCreateActionInput({
        description: `😀`.repeat(5001),
        followUpRequired: false,
        requestId,
        version: 1,
      })
    );
  });

  it("requires a nonblank follow-up note when follow-up is required", async () => {
    await assertValidationError(() =>
      validateCreateActionInput({
        description: "Do the work.",
        followUpRequired: true,
        requestId,
        version: 1,
      })
    );

    await assertValidationError(() =>
      validateCreateActionInput({
        description: "Do the work.",
        followUpNote: "A note is not allowed here.",
        followUpRequired: false,
        requestId,
        version: 1,
      })
    );
  });

  it("rejects spoofed or unsupported create fields and malformed identities", async () => {
    await assertValidationError(() =>
      validateCreateActionInput({
        ...validCreateBody(),
        actorId: 99,
      })
    );

    await assertValidationError(() =>
      validateCreateActionInput({
        ...validCreateBody(),
        requestId: "not-a-uuid",
      })
    );

    await assertValidationError(() =>
      validateCreateActionInput({
        ...validCreateBody(),
        version: 0,
      })
    );
  });
});

describe("Action Taken list query rules", () => {
  it("defaults to page one with a page size of twenty", () => {
    assert.deepEqual(parseActionListQuery({}), { page: 1, pageSize: 20 });
  });

  it("accepts only the documented page sizes", async () => {
    for (const pageSize of [10, 20, 50]) {
      assert.deepEqual(
        parseActionListQuery({ page: "2", pageSize: String(pageSize) }),
        {
          page: 2,
          pageSize,
        }
      );
    }

    await assertValidationError(() => parseActionListQuery({ pageSize: "25" }));
  });

  it("rejects unknown, duplicate, and malformed query values", async () => {
    await assertValidationError(() =>
      parseActionListQuery({ status: "Planned" })
    );
    await assertValidationError(() =>
      parseActionListQuery({ page: ["1", "2"] })
    );
    await assertValidationError(() => parseActionListQuery({ page: "0" }));
  });
});
