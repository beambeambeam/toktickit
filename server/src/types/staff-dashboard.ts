import type { ActionStatus } from "./actions.js";
import type {
  CurrentStatus,
  OwnerRecord,
  RequestedPriority,
} from "./tickets.js";

export interface StaffDashboardTicketPreview {
  currentStatus: CurrentStatus;
  id: number;
  itPriority: RequestedPriority;
  owner: OwnerRecord | null;
  requestedPriority: RequestedPriority;
  resolvedAt: string | null;
  summary: string;
  ticketNumber: string;
  updatedAt: string;
}

export interface MyActionRow {
  assignee: OwnerRecord;
  description: string;
  followUpRequired: boolean;
  id: number;
  status: ActionStatus;
  ticket: {
    currentStatus: CurrentStatus;
    id: number;
    summary: string;
    ticketNumber: string;
  };
  ticketId: number;
  updatedAt: string;
}

export interface StaffDashboardResponse {
  counts: {
    activeByPriority: Record<RequestedPriority, number>;
    activeOwned: number;
    activeUnassigned: number;
    byStatus: Record<CurrentStatus, number>;
    myActions: number;
  };
  generatedAt: string;
  previews: {
    myActions: MyActionRow[];
    recentlyUpdatedTickets: StaffDashboardTicketPreview[];
    urgentActiveTickets: StaffDashboardTicketPreview[];
  };
  window: {
    from: string;
    through: string;
  };
}
