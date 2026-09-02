export type RequestedPriority = "Low" | "Medium" | "High" | "Urgent";

export type CurrentStatus = "New";

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

export interface TicketFields {
  categoryId: number;
  description: string;
  relatedSystemId: number;
  requestedPriority: RequestedPriority;
  summary: string;
}
