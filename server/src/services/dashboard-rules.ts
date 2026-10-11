import { activeTicketStatuses } from "../types/ticket-workflow.js";
import type { CurrentStatus } from "../types/tickets.js";

export { getSevenDayWindow } from "../types/dashboard.js";

export const ACTIVE_TICKET_STATUSES = activeTicketStatuses;

export const isActiveTicketStatus = (status: CurrentStatus): boolean =>
  ACTIVE_TICKET_STATUSES.includes(status);

export const isWithinInclusiveWindow = (
  value: Date,
  from: Date,
  through: Date
): boolean =>
  value.getTime() >= from.getTime() && value.getTime() <= through.getTime();
