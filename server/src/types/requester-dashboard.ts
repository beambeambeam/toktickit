import type { CurrentStatus, RequestedPriority } from "./tickets.js";

export interface RequesterDashboardTicketPreview {
  currentStatus: CurrentStatus;
  id: number;
  requestedPriority: RequestedPriority;
  resolvedAt: string | null;
  summary: string;
  ticketNumber: string;
  updatedAt: string;
}

export interface RequesterDashboardResponse {
  counts: {
    activeTickets: number;
    recentlyResolved: number;
    recentlyUpdated: number;
    waitingForRequester: number;
  };
  generatedAt: string;
  previews: {
    recentlyResolved: RequesterDashboardTicketPreview[];
    recentlyUpdated: RequesterDashboardTicketPreview[];
  };
  window: {
    from: string;
    through: string;
  };
}
