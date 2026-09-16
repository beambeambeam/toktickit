import type { UserRoleLabel } from "./users.js";

export type RequestedPriority = "Low" | "Medium" | "High" | "Urgent";

export type CurrentStatus =
  | "New"
  | "Open"
  | "In Progress"
  | "Waiting for Requester"
  | "Resolved"
  | "Closed"
  | "Reopened"
  | "Cancelled";

export type TicketSortField =
  | "ticketNumber"
  | "ticketDate"
  | "summary"
  | "requestedPriority"
  | "currentStatus"
  | "updatedAt";

export type TicketSortDirection = "asc" | "desc";

export interface TicketListQuery {
  categoryId?: number;
  currentStatus?: CurrentStatus;
  page: number;
  pageSize: 10 | 25 | 50;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  search?: string;
  sortBy: TicketSortField;
  sortDirection: TicketSortDirection;
}

export type StaffTicketSortField =
  | "ticketDate"
  | "updatedAt"
  | "itPriority"
  | "ticketNumber";

export type StaffTicketOwnerFilter = number | "me" | "unassigned";

export interface StaffTicketListQuery {
  categoryId?: number;
  currentStatus?: CurrentStatus;
  itPriority?: RequestedPriority;
  owner?: StaffTicketOwnerFilter;
  page: number;
  pageSize: 10 | 20 | 50;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  search?: string;
  sortBy: StaffTicketSortField;
  sortDirection: TicketSortDirection;
}

export interface TicketFields {
  categoryId: number;
  description: string;
  relatedSystemId: number;
  requestedPriority: RequestedPriority;
  summary: string;
}

export interface OwnerRecord {
  displayName: string;
  id: number;
  isActive: boolean;
  isEligible: boolean;
  role: UserRoleLabel;
}
