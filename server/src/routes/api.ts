import express, { Router } from "express";

import {
  createAction,
  editAction,
  getActionHistory,
  getActions,
  getStaffActions,
  transitionAction,
} from "../controllers/actions.js";
import { changePassword, getMe, login, logout } from "../controllers/auth.js";
import { getHealth } from "../controllers/health.js";
import {
  getCategories,
  getRelatedSystems,
} from "../controllers/reference-data.js";
import { getRequesterDashboardController } from "../controllers/requester-dashboard.js";
import { getStaffDashboardController } from "../controllers/staff-dashboard.js";
import {
  addAttachments,
  createInternalNote,
  claimTicket,
  createPublicComment,
  createTicket,
  downloadAttachment,
  getAttachments,
  getInternalNotes,
  getStatusHistory,
  getStaffOwners,
  getStaffTickets,
  getTicket,
  getPublicComments,
  getTickets,
  indicateTicketResolution,
  removeAttachment,
  updateTicketStatus,
  updateTicketItPriority,
  updateTicketOwner,
} from "../controllers/tickets.js";
import {
  createUser,
  getUser,
  getUsers,
  resetUserInitialPassword,
  updateUser,
} from "../controllers/users.js";
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
apiRouter.get(
  "/staff/tickets",
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  touchSession,
  getStaffTickets
);
apiRouter.get(
  "/staff/owners",
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  touchSession,
  getStaffOwners
);
apiRouter.get(
  "/staff/dashboard",
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  touchSession,
  getStaffDashboardController
);
apiRouter.get(
  "/staff/actions",
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  touchSession,
  getStaffActions
);
apiRouter.get(
  "/tickets/:ticketId/actions",
  requireSession,
  requireUnrestricted,
  requireRole("Requester", "ITStaff", "Administrator"),
  touchSession,
  getActions
);
apiRouter.get(
  "/tickets/:ticketId/actions/:actionId/history",
  requireSession,
  requireUnrestricted,
  requireRole("Requester", "ITStaff", "Administrator"),
  touchSession,
  getActionHistory
);
apiRouter.post(
  "/tickets/:ticketId/actions",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  createAction
);
apiRouter.put(
  "/tickets/:ticketId/actions/:actionId",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  editAction
);
apiRouter.post(
  "/tickets/:ticketId/actions/:actionId/transition",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  transitionAction
);
apiRouter.post(
  "/tickets/:ticketId/status",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  updateTicketStatus
);
apiRouter.put(
  "/tickets/:ticketId/resolution-indication",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  requireCsrf,
  touchSession,
  indicateTicketResolution
);
apiRouter.post(
  "/tickets/:ticketId/claim",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  claimTicket
);
apiRouter.put(
  "/tickets/:ticketId/owner",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  updateTicketOwner
);
apiRouter.patch(
  "/tickets/:ticketId/it-priority",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  updateTicketItPriority
);
apiRouter.get("/health", getHealth);
apiRouter.get(
  "/users",
  requireSession,
  requireUnrestricted,
  requireRole("Administrator"),
  touchSession,
  getUsers
);
apiRouter.post(
  "/users",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Administrator"),
  requireCsrf,
  touchSession,
  createUser
);
apiRouter.get(
  "/users/:userId",
  requireSession,
  requireUnrestricted,
  requireRole("Administrator"),
  touchSession,
  getUser
);
apiRouter.patch(
  "/users/:userId",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Administrator"),
  requireCsrf,
  touchSession,
  updateUser
);
apiRouter.post(
  "/users/:userId/initial-password",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Administrator"),
  requireCsrf,
  touchSession,
  resetUserInitialPassword
);
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
  "/requester/dashboard",
  requireSession,
  requireUnrestricted,
  requireRole("Requester"),
  touchSession,
  getRequesterDashboardController
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
  requireRole("Requester", "ITStaff", "Administrator"),
  touchSession,
  getTicket
);
apiRouter.get(
  "/tickets/:ticketId/attachments",
  requireSession,
  requireUnrestricted,
  requireRole("Requester", "ITStaff", "Administrator"),
  touchSession,
  getAttachments
);
apiRouter.get(
  "/tickets/:ticketId/status-history",
  requireSession,
  requireUnrestricted,
  requireRole("Requester", "ITStaff", "Administrator"),
  touchSession,
  getStatusHistory
);
apiRouter.get(
  "/tickets/:ticketId/internal-notes",
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  touchSession,
  getInternalNotes
);
apiRouter.post(
  "/tickets/:ticketId/internal-notes",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  createInternalNote
);
apiRouter.get(
  "/tickets/:ticketId/comments",
  requireSession,
  requireUnrestricted,
  requireRole("Requester", "ITStaff", "Administrator"),
  touchSession,
  getPublicComments
);
apiRouter.post(
  "/tickets/:ticketId/comments",
  requireAllowedOrigin,
  requireSession,
  requireUnrestricted,
  requireRole("Requester", "ITStaff", "Administrator"),
  requireCsrf,
  touchSession,
  createPublicComment
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
  requireRole("Requester", "ITStaff", "Administrator"),
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
