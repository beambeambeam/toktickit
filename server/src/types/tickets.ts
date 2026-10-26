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

export type TicketListScope =
  | "active"
  | "waiting-for-requester"
  | "recently-updated"
  | "recently-resolved";

export type TicketSortField =
  | "ticketNumber"
  | "ticketDate"
  | "summary"
  | "requestedPriority"
  | "currentStatus"
  | "updatedAt"
  | "resolvedAt";

export type TicketSortDirection = "asc" | "desc";

export interface TicketListQuery {
  categoryId?: number;
  currentStatus?: CurrentStatus;
  from?: Date;
  page: number;
  pageSize: 10 | 25 | 50;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  scope?: TicketListScope;
  search?: string;
  sortBy: TicketSortField;
  sortDirection: TicketSortDirection;
  through?: Date;
}

export type StaffTicketSortField =
  | "ticketDate"
  | "updatedAt"
  | "itPriority"
  | "ticketNumber";

export type StaffTicketOwnerFilter = number | "me" | "unassigned";

export type StaffTicketListScope =
  | "active"
  | "recently-updated"
  | "urgent-active";

export interface StaffTicketListQuery {
  categoryId?: number;
  currentStatus?: CurrentStatus;
  from?: Date;
  itPriority?: RequestedPriority;
  owner?: StaffTicketOwnerFilter;
  page: number;
  pageSize: 10 | 20 | 50;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  scope?: StaffTicketListScope;
  search?: string;
  sortBy: StaffTicketSortField;
  sortDirection: TicketSortDirection;
  through?: Date;
}

export interface TicketFields {
  categoryId: number;
  description: string;
  relatedSystemId: number;
  requestedPriority: RequestedPriority;
  summary: string;
}

export interface TicketVersionInput {
  version: number;
}

export interface StatusMutationInput extends TicketVersionInput {
  confirmed?: boolean;
  currentStatus: CurrentStatus;
}

export interface OwnerMutationInput extends TicketVersionInput {
  ownerId: number | null;
}

export interface ItPriorityMutationInput extends TicketVersionInput {
  itPriority: RequestedPriority;
}

export interface OwnerRecord {
  displayName: string;
  id: number;
  isActive: boolean;
  isEligible: boolean;
  role: UserRoleLabel;
}
