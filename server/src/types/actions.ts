export type ActionStatus =
  | "Planned"
  | "In Progress"
  | "Completed"
  | "Cancelled";

export type ActionListPageSize = 10 | 20 | 50;

export interface ActionListQuery {
  page: number;
  pageSize: ActionListPageSize;
}

export interface CreateActionInput {
  assigneeId: number | null;
  attachmentNotes: string | null;
  description: string;
  followUpNote: string | null;
  followUpRequired: boolean;
  requestId: string;
  result: string | null;
  version: number;
}

export interface EditActionInput {
  actionVersion: number;
  assigneeId: number;
  attachmentNotes: string | null;
  description: string;
  followUpNote: string | null;
  followUpRequired: boolean;
  result: string | null;
  ticketVersion: number;
}
