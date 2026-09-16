import type { RequestHandler } from "express";

import { ApiError } from "../errors/api-error.js";
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
} from "../middlewares/auth-context.js";
import {
  parseStaffTicketListQuery,
  parseTicketListQuery,
  validateEmptyRequest,
  validateClaimInput,
  validateItPriorityMutation,
  validateOwnerMutation,
  validateRemovalReason,
  validateStatusMutation,
  validateTicketFields,
} from "../services/ticket-rules.js";
import type { AttachmentCandidate } from "../services/ticket-rules.js";
import {
  addAttachmentsForRequester,
  claimTicketForStaff,
  createTicketForRequester,
  createPublicCommentForUser,
  downloadAttachmentForReader,
  getAttachmentsForReader,
  listInternalNotesForReader,
  getTicketForReader,
  indicateTicketResolutionForRequester,
  listPublicCommentsForReader,
  listStaffOwners,
  listStaffTickets,
  listTicketsForRequester,
  removeAttachmentForRequester,
  createInternalNoteForUser,
  updateTicketStatusForStaff,
  updateTicketItPriorityForStaff,
  updateTicketOwnerForStaff,
} from "../services/tickets.js";

const parseId = (value: unknown, field: string): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", {
      field,
      reason: `${field} must be a positive integer.`,
    });
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
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
    getAuthenticatedUserId(response),
    fields,
    getAttachmentCandidates(request.files)
  );

  response.status(201).json({ ticket });
};

export const getTickets: RequestHandler = async (request, response) => {
  const query = parseTicketListQuery(request.query);
  const tickets = await listTicketsForRequester(
    getAuthenticatedUserId(response),
    query
  );

  response.json(tickets);
};

export const getStaffTickets: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const query = parseStaffTicketListQuery(request.query);
  const tickets = await listStaffTickets(user.id, query);

  response.json(tickets);
};

export const getStaffOwners: RequestHandler = async (_request, response) => {
  response.json({ items: await listStaffOwners() });
};

export const updateTicketStatus: RequestHandler = async (request, response) => {
  const ticket = await updateTicketStatusForStaff(
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId"),
    validateStatusMutation(request.body)
  );

  response.json(ticket);
};

export const claimTicket: RequestHandler = async (request, response) => {
  const ticket = await claimTicketForStaff(
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId"),
    validateClaimInput(request.body)
  );

  response.json(ticket);
};

export const indicateTicketResolution: RequestHandler = async (
  request,
  response
) => {
  validateEmptyRequest(request.body);
  const indication = await indicateTicketResolutionForRequester(
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId")
  );

  response.json(indication);
};

export const updateTicketOwner: RequestHandler = async (request, response) => {
  const ticket = await updateTicketOwnerForStaff(
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId"),
    validateOwnerMutation(request.body)
  );

  response.json(ticket);
};

export const updateTicketItPriority: RequestHandler = async (
  request,
  response
) => {
  const ticket = await updateTicketItPriorityForStaff(
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId"),
    validateItPriorityMutation(request.body)
  );

  response.json(ticket);
};

export const getTicket: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const ticket = await getTicketForReader(
    user.id,
    user.role,
    parseId(request.params.ticketId, "ticketId")
  );

  response.json(ticket);
};

export const getAttachments: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const attachments = await getAttachmentsForReader(
    user.id,
    user.role,
    parseId(request.params.ticketId, "ticketId")
  );

  response.json({ attachments });
};

export const getInternalNotes: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const internalNotes = await listInternalNotesForReader(
    user.role,
    parseId(request.params.ticketId, "ticketId")
  );

  response.json({ internalNotes });
};

export const createInternalNote: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const internalNote = await createInternalNoteForUser(
    user.id,
    user.role,
    parseId(request.params.ticketId, "ticketId"),
    getBodyObject(request.body)
  );

  response.status(201).json({ internalNote });
};

export const getPublicComments: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const comments = await listPublicCommentsForReader(
    user.id,
    user.role,
    parseId(request.params.ticketId, "ticketId")
  );

  response.json({ comments });
};

export const createPublicComment: RequestHandler = async (
  request,
  response
) => {
  const user = getAuthenticatedUser(response);
  const comment = await createPublicCommentForUser(
    user.id,
    user.role,
    parseId(request.params.ticketId, "ticketId"),
    getBodyObject(request.body)
  );

  response.status(201).json({ comment });
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
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId"),
    attachmentCandidates
  );

  response.status(201).json({ attachments });
};

export const downloadAttachment: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(response);
  const attachment = await downloadAttachmentForReader(
    user.id,
    user.role,
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
      "X-Content-Type-Options": "nosniff",
    })
    .send(attachment.content);
};

export const removeAttachment: RequestHandler = async (request, response) => {
  const body = getBodyObject(request.body);
  const attachment = await removeAttachmentForRequester(
    getAuthenticatedUserId(response),
    parseId(request.params.ticketId, "ticketId"),
    parseId(request.params.attachmentId, "attachmentId"),
    validateRemovalReason(body.reason)
  );

  response.json({ attachment });
};
