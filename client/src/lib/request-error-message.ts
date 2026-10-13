import { ApiConnectionError } from "@/api/client";

export const getRequestErrorMessage = (
  error: unknown,
  fallback: string
): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
};
