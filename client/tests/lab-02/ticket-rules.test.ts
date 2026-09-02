/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "@/api/requester";
import {
  getApiFieldErrors,
  validateSelectedFiles,
  validateTicketForm,
} from "@/lib/ticket-rules";

const validValues = {
  categoryId: "1",
  description: "The requester cannot reach the selected system.",
  relatedSystemId: "2",
  requestedPriority: "High",
  summary: "Network outage",
} as const;

const createFile = (name: string, type: string, size = 12) =>
  new File([new Uint8Array(size)], name, { type });

describe("Lab 2 client ticket rules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts valid form values and rejects missing or over-limit fields", () => {
    expect(validateTicketForm(validValues)).toEqual({});
    expect(
      validateTicketForm({
        ...validValues,
        description: "short",
        summary: "  ",
      })
    ).toEqual({
      description:
        "Description must contain 20–4000 characters after trimming.",
      summary: "Summary must contain 5–120 characters after trimming.",
    });
  });

  it("validates Attachment type, count, and size before submission", () => {
    const validPdf = createFile("evidence.pdf", "application/pdf");
    expect(validateSelectedFiles([validPdf])).toEqual({
      errors: [],
      validFiles: [validPdf],
    });

    expect(
      validateSelectedFiles([createFile("spoof.pdf", "image/png")]).errors
    ).toEqual(["spoof.pdf: use JPG, JPEG, PNG, WEBP, or PDF."]);

    expect(
      validateSelectedFiles([
        createFile("large.png", "image/png", 5 * 1024 * 1024 + 1),
      ]).errors
    ).toEqual(["large.png: each attachment must be at most 5 MB."]);

    const sixFiles = Array.from({ length: 6 }, (_, index) =>
      createFile(`evidence-${index}.png`, "image/png")
    );
    expect(validateSelectedFiles(sixFiles).errors[0]).toBe(
      "Choose no more than five attachments."
    );
  });

  it("maps safe API field details to form fields", () => {
    const error = new ApiRequestError(
      400,
      "Request validation failed.",
      "VALIDATION_ERROR",
      {
        fields: {
          categoryId: "Choose an active Category.",
          summary: "Summary is too short.",
        },
      }
    );

    expect(getApiFieldErrors(error)).toEqual({
      categoryId: "Choose an active Category.",
      summary: "Summary is too short.",
    });
  });
});
