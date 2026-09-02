import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { createTicketNumber } from "../../src/services/ticket-number.js";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ACTIVE_ATTACHMENTS,
  normalizeAttachmentFilename,
  parseTicketListQuery,
  validateAttachmentFiles,
  validateTicketFields,
} from "../../src/services/ticket-rules.js";

const validDescription =
  "The requester cannot reach the campus network from the assigned device.";

describe("Lab 2 ticket rules", () => {
  it("trims valid ticket text and generates the documented number format", () => {
    const fields = validateTicketFields({
      categoryId: "2",
      description: `  ${validDescription}  `,
      relatedSystemId: "3",
      requestedPriority: "High",
      summary: "  Wi-Fi is unavailable  ",
    });

    assert.deepEqual(fields, {
      categoryId: 2,
      description: validDescription,
      relatedSystemId: 3,
      requestedPriority: "High",
      summary: "Wi-Fi is unavailable",
    });
    assert.equal(
      createTicketNumber(new Date("2026-08-22T10:00:00.000Z"), "A1B2C3"),
      "TKT-20260822-A1B2C3"
    );
  });

  it("reports field-level errors for invalid ticket fields", () => {
    assert.throws(
      () =>
        validateTicketFields({
          categoryId: "not-an-id",
          description: "too short",
          relatedSystemId: "0",
          requestedPriority: "Critical",
          summary: "  ",
        }),
      /Request validation failed/u
    );
  });

  it("uses documented list defaults and rejects invalid query values", () => {
    assert.deepEqual(parseTicketListQuery({}), {
      page: 1,
      pageSize: 10,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    assert.throws(
      () => parseTicketListQuery({ pageSize: "20" }),
      /Request validation failed/u
    );
  });

  it("normalizes display filenames without using them as storage paths", () => {
    assert.equal(
      normalizeAttachmentFilename("../<network> report\u0000.png"),
      "_network_ report_.png"
    );
  });

  it("accepts signed files at the limit and rejects excess active files", () => {
    const file = {
      buffer: Buffer.concat([
        Buffer.from("%PDF-1.7\n"),
        Buffer.alloc(MAX_ATTACHMENT_BYTES - Buffer.byteLength("%PDF-1.7\n")),
      ]),
      mimetype: "application/pdf",
      originalname: "evidence.pdf",
      size: MAX_ATTACHMENT_BYTES,
    };

    assert.equal(
      validateAttachmentFiles([file])[0]?.originalFilename,
      "evidence.pdf"
    );
    assert.throws(
      () =>
        validateAttachmentFiles(
          Array.from({ length: MAX_ACTIVE_ATTACHMENTS + 1 }, () => file)
        ),
      /Attachment limit exceeded/u
    );
  });
});
