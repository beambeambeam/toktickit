import { expect, it } from "vitest";

import {
  getActionPayload,
  hashActionPayload,
} from "../../src/models/action-payload.js";
import { validateCreateActionInput } from "../../src/services/action-rules.js";

it("hashes normalized business fields in the documented canonical order", () => {
  const input = validateCreateActionInput({
    assigneeId: 9,
    attachmentNotes: "  See the existing cable photo.  ",
    description: "  Replace the damaged network cable.\nTest both ports.  ",
    followUpNote: "  Confirm connectivity with the requester.  ",
    followUpRequired: true,
    requestId: "a5726990-c560-45d5-ae76-2f75659bb540",
    result: "  Cable replaced.  ",
    version: 7,
  });
  expect(hashActionPayload(getActionPayload(input, 9))).toBe(
    "420655d65d81a6e5095f5c8f26aadec7463c5ff4420002defecc70907ca31d86"
  );
});
