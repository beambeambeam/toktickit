import type { RequestHandler } from "express";
import multer from "multer";

import { ApiError } from "../errors/api-error.js";
import {
  MAX_ACTIVE_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
} from "../services/ticket-rules.js";

const multipartUpload = multer({
  limits: {
    fields: 10,
    fileSize: MAX_ATTACHMENT_BYTES,
    files: MAX_ACTIVE_ATTACHMENTS + 1,
    parts: 20,
  },
  storage: multer.memoryStorage(),
});

const uploadError = (code: string, message: string, statusCode: number) =>
  new ApiError(statusCode, code, message);

// Multer exposes its parser through a callback-based middleware API.
// oxlint-disable promise/prefer-await-to-callbacks
export const parseAttachmentUpload: RequestHandler = (
  request,
  response,
  next
) => {
  multipartUpload.array("attachments", MAX_ACTIVE_ATTACHMENTS + 1)(
    request,
    response,
    (error: unknown) => {
      if (error === undefined || error === null) {
        next();
        return;
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
      ) {
        if (error.code === "LIMIT_FILE_SIZE") {
          next(
            uploadError(
              "ATTACHMENT_TOO_LARGE",
              "Attachment exceeds the 5 MB limit.",
              413
            )
          );
          return;
        }

        if (error.code === "LIMIT_FILE_COUNT") {
          next(
            uploadError(
              "ATTACHMENT_LIMIT_EXCEEDED",
              "Attachment limit exceeded.",
              409
            )
          );
          return;
        }

        if (
          error.code === "LIMIT_PART_COUNT" ||
          error.code === "LIMIT_FIELD_COUNT" ||
          error.code === "LIMIT_FIELD_KEY" ||
          error.code === "LIMIT_FIELD_VALUE"
        ) {
          next(
            uploadError(
              "INVALID_MULTIPART_REQUEST",
              "Multipart request exceeds the permitted limits.",
              400
            )
          );
          return;
        }

        if (error.code === "LIMIT_UNEXPECTED_FILE") {
          next(
            uploadError(
              "INVALID_ATTACHMENT_FIELD",
              "Attachments must use the attachments field.",
              400
            )
          );
          return;
        }
      }

      next(error);
    }
  );
};
// oxlint-enable promise/prefer-await-to-callbacks
