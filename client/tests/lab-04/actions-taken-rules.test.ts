/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";

import { normalizeActionForm, validateActionForm } from "@/lib/action-rules";

describe("Actions Taken form rules", () => {
  it("normalizes optional plain text and clears a follow-up note when disabled", () => {
    expect(
      normalizeActionForm({
        assigneeId: "12",
        attachmentNotes: "  See the photo.  ",
        description: "  Replace the cable.\nVerify both ports.  ",
        followUpNote: "  Should be cleared.  ",
        followUpRequired: false,
        result: "   ",
      })
    ).toEqual({
      assigneeId: 12,
      attachmentNotes: "See the photo.",
      description: "Replace the cable.\nVerify both ports.",
      followUpNote: null,
      followUpRequired: false,
      result: null,
    });
  });

  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(
      validateActionForm({
        assigneeId: "12",
        attachmentNotes: "😀".repeat(2000),
        description: "😀".repeat(5000),
        followUpNote: "A follow-up",
        followUpRequired: true,
        result: "Result",
      })
    ).toEqual({});

    expect(
      validateActionForm({
        assigneeId: "12",
        attachmentNotes: "😀".repeat(2001),
        description: "😀".repeat(5001),
        followUpNote: "😀".repeat(5001),
        followUpRequired: true,
        result: "😀".repeat(5001),
      })
    ).toEqual({
      attachmentNotes:
        "Attachment Notes must contain at most 2,000 Unicode characters.",
      description:
        "Action Description must contain 1–5,000 Unicode characters after trimming.",
      followUpNote:
        "Follow-up Note must contain 1–5,000 Unicode characters when follow-up is required.",
      result: "Result must contain at most 5,000 Unicode characters.",
    });
  });

  it("requires a nonblank follow-up note only when follow-up is required", () => {
    expect(
      validateActionForm({
        assigneeId: "12",
        attachmentNotes: "",
        description: "Replace the cable",
        followUpNote: "  ",
        followUpRequired: true,
        result: "",
      })
    ).toEqual({
      followUpNote:
        "Follow-up Note is required when Follow-Up Required is selected.",
    });

    expect(
      validateActionForm({
        assigneeId: "12",
        attachmentNotes: "",
        description: "  Replace the cable  ",
        followUpNote: "  ",
        followUpRequired: false,
        result: "",
      })
    ).toEqual({});
  });
});
