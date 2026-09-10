import express, { Router } from "express";

import { changePassword, getMe, login, logout } from "../controllers/auth.js";
import { getHealth } from "../controllers/health.js";
import {
  getCategories,
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
import {
  requireAllowedOrigin,
  requireCsrf,
  requireRole,
  requireSession,
  requireUnrestricted,
  touchSession,
} from "../middlewares/auth-context.js";
import { parseAttachmentUpload } from "../middlewares/uploads.js";

export const apiRouter = Router();

apiRouter.use(express.json({ limit: "1mb" }));
apiRouter.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

apiRouter.post("/auth/login", requireAllowedOrigin, login);
apiRouter.get("/auth/me", requireSession, touchSession, getMe);
apiRouter.post(
  "/auth/change-password",
  requireAllowedOrigin,
  requireSession,
  requireCsrf,
  changePassword
);
apiRouter.post(
  "/auth/logout",
  requireAllowedOrigin,
  requireSession,
  requireCsrf,
  logout
);

apiRouter.get(
  "/categories",
  requireSession,
  requireUnrestricted,
  touchSession,
  getCategories
);
apiRouter.get(
  "/related-systems",
  requireSession,
  requireUnrestricted,
  touchSession,
  getRelatedSystems
);
apiRouter.get("/health", getHealth);
apiRouter.post(
  "/tickets",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  requireCsrf,
  touchSession,
  parseAttachmentUpload,
  createTicket
);
apiRouter.get(
  "/tickets",
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  touchSession,
  getTickets
);
apiRouter.get(
  "/tickets/:ticketId",
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  touchSession,
  getTicket
);
apiRouter.get(
  "/tickets/:ticketId/attachments",
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  touchSession,
  getAttachments
);
apiRouter.post(
  "/tickets/:ticketId/attachments",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  requireCsrf,
  touchSession,
  parseAttachmentUpload,
  addAttachments
);
apiRouter.get(
  "/tickets/:ticketId/attachments/:attachmentId/content",
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  touchSession,
  downloadAttachment
);
apiRouter.delete(
  "/tickets/:ticketId/attachments/:attachmentId",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  requireCsrf,
  touchSession,
  removeAttachment
);
apiRouter.use(apiNotFound);
apiRouter.use(apiErrorHandler);
