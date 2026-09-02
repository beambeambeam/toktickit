import type { RequestHandler } from "express";

import { ApiError } from "../errors/api-error.js";
import { getRequesterId } from "../middlewares/requester-context.js";
import {
  parseTicketListQuery,
  validateRemovalReason,
  validateTicketFields,
} from "../services/ticket-rules.js";
import type { AttachmentCandidate } from "../services/ticket-rules.js";
import {
  addAttachmentsForRequester,
  createTicketForRequester,
  downloadAttachmentForRequester,
  getAttachmentsForRequester,
  getTicketForRequester,
  listTicketsForRequester,
  removeAttachmentForRequester,
} from "../services/tickets.js";

const parseId = (value: unknown, field: string): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: `${field} must be a positive integer.`,
    });
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: `${field} must be a positive integer.`,
    });
  }

  return id;
};

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUploadedFile = (value: unknown): value is UploadedFile =>
  isRecord(value) &&
  Buffer.isBuffer(value.buffer) &&
  typeof value.mimetype === "string" &&
  typeof value.originalname === "string" &&
  typeof value.size === "number";

const getAttachmentCandidates = (files: unknown): AttachmentCandidate[] => {
  if (!Array.isArray(files)) {
    return [];
  }

  return files.map((file: unknown) => {
    if (!isUploadedFile(file)) {
      throw new ApiError(
        400,
        "INVALID_ATTACHMENT",
        "Attachment metadata is invalid."
      );
    }

    return {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    };
  });
};

const getBodyObject = (body: unknown): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "body",
      reason: "Request body must be an object.",
    });
  }

  return body;
};

export const createTicket: RequestHandler = async (request, response) => {
  const fields = validateTicketFields(getBodyObject(request.body));
  const ticket = await createTicketForRequester(
    getRequesterId(response),
    fields,
    getAttachmentCandidates(request.files)
  );

  response.status(201).json({ ticket });
};

export const getTickets: RequestHandler = async (request, response) => {
  const query = parseTicketListQuery(request.query);
  const tickets = await listTicketsForRequester(
    getRequesterId(response),
    query
  );

  response.json(tickets);
};

export const getTicket: RequestHandler = async (request, response) => {
  const ticket = await getTicketForRequester(
    getRequesterId(response),
    parseId(request.params.ticketId, "ticketId")
  );

  response.json(ticket);
};

export const getAttachments: RequestHandler = async (request, response) => {
  const attachments = await getAttachmentsForRequester(
    getRequesterId(response),
    parseId(request.params.ticketId, "ticketId")
  );

  response.json({ attachments });
};

export const addAttachments: RequestHandler = async (request, response) => {
  const attachmentCandidates = getAttachmentCandidates(request.files);

  if (attachmentCandidates.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field: "attachments",
      reason: "At least one attachment is required.",
    });
  }

  const attachments = await addAttachmentsForRequester(
    getRequesterId(response),
    parseId(request.params.ticketId, "ticketId"),
    attachmentCandidates
  );

  response.status(201).json({ attachments });
};

export const downloadAttachment: RequestHandler = async (request, response) => {
  const attachment = await downloadAttachmentForRequester(
    getRequesterId(response),
    parseId(request.params.ticketId, "ticketId"),
    parseId(request.params.attachmentId, "attachmentId")
  );
  const encodedFilename = encodeURIComponent(attachment.originalFilename);

  response
    .set({
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
      "Content-Length": attachment.content.byteLength.toString(),
      "Content-Type": attachment.mediaType,
    })
    .send(attachment.content);
};

export const removeAttachment: RequestHandler = async (request, response) => {
  const body = getBodyObject(request.body);
  const attachment = await removeAttachmentForRequester(
    getRequesterId(response),
    parseId(request.params.ticketId, "ticketId"),
    parseId(request.params.attachmentId, "attachmentId"),
    validateRemovalReason(body.reason)
  );

  response.json({ attachment });
};
