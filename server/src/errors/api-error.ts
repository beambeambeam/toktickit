export interface ApiErrorDetails {
  field?: string;
  reason?: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly details: ApiErrorDetails | undefined;
  readonly statusCode: number;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: ApiErrorDetails
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}
