import express, { Router } from "express";

import { getHealth } from "../controllers/health.js";
import {
  getCategories,
  getDevelopmentRequesters,
  getRelatedSystems,
} from "../controllers/reference-data.js";
import {
  addAttachments,
  createTicket,
  downloadAttachment,
  getAttachments,
  getTicket,
  getTickets,
  removeAttachment,
} from "../controllers/tickets.js";
import { apiErrorHandler, apiNotFound } from "../middlewares/api-errors.js";
import { requireRequesterContext } from "../middlewares/requester-context.js";
import { parseAttachmentUpload } from "../middlewares/uploads.js";

export const apiRouter = Router();

apiRouter.use(express.json({ limit: "1mb" }));
apiRouter.get("/categories", getCategories);
apiRouter.get("/related-systems", getRelatedSystems);
apiRouter.get("/development-requesters", getDevelopmentRequesters);
apiRouter.get("/health", getHealth);
apiRouter.post(
  "/tickets",
  requireRequesterContext,
  parseAttachmentUpload,
  createTicket
);
apiRouter.get("/tickets", requireRequesterContext, getTickets);
apiRouter.get("/tickets/:ticketId", requireRequesterContext, getTicket);
apiRouter.get(
  "/tickets/:ticketId/attachments",
  requireRequesterContext,
  getAttachments
);
apiRouter.post(
  "/tickets/:ticketId/attachments",
  requireRequesterContext,
  parseAttachmentUpload,
  addAttachments
);
apiRouter.get(
  "/tickets/:ticketId/attachments/:attachmentId/content",
  requireRequesterContext,
  downloadAttachment
);
apiRouter.delete(
  "/tickets/:ticketId/attachments/:attachmentId",
  requireRequesterContext,
  removeAttachment
);
apiRouter.use(apiNotFound);
apiRouter.use(apiErrorHandler);
