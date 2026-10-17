import { ApiRequestError } from "@/api/errors";

export type LoadFailureKind = "forbidden" | "generic" | "session";

export interface LoadFailureMessage {
  body: string;
  heading: string;
}

export const loadFailureKind = (error: unknown): LoadFailureKind => {
  if (error instanceof ApiRequestError && error.status === 401) {
    return "session";
  }
  if (error instanceof ApiRequestError && error.status === 403) {
    return "forbidden";
  }
  return "generic";
};

export const buildLoadFailureCopy = (copy: {
  forbiddenBody: string;
  genericBody: string;
  genericHeading: string;
  sessionBody: string;
}): Record<LoadFailureKind, LoadFailureMessage> => ({
  forbidden: { body: copy.forbiddenBody, heading: "Access denied" },
  generic: { body: copy.genericBody, heading: copy.genericHeading },
  session: { body: copy.sessionBody, heading: "Your session has ended" },
});
