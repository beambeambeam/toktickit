export type RequestedPriority = "Low" | "Medium" | "High" | "Urgent";

export const isRequestedPriority = (
  value: unknown
): value is RequestedPriority =>
  value === "Low" ||
  value === "Medium" ||
  value === "High" ||
  value === "Urgent";
