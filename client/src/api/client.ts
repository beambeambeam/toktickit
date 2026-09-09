import { env } from "@/env";
import { client } from "@/generated/hey-api/client.gen";

export const AUTH_SESSION_LOST_EVENT = "toktickit:auth-session-lost";
const CSRF_HEADER = "X-CSRF-Token";
const csrfProtectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfToken: string | null = null;

export const getCsrfToken = (): string | null => csrfToken;

export const setCsrfToken = (nextToken: string): void => {
  csrfToken = nextToken;
};

export const clearCsrfToken = (): void => {
  csrfToken = null;
};

export class ApiConnectionError extends Error {
  constructor(cause: unknown) {
    super("Unable to connect to TokTickIT API", { cause });
    this.name = "ApiConnectionError";
  }
}

const isLoginRequest = (input: RequestInfo | URL): boolean => {
  if (input instanceof Request) {
    return new URL(input.url).pathname === "/api/auth/login";
  }

  return (
    new URL(input.toString(), env.VITE_API_URL).pathname === "/api/auth/login"
  );
};

const addCsrfHeader = (
  input: RequestInfo | URL,
  init: RequestInit | undefined
): Request => {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined
  );
  if (init?.headers !== undefined) {
    for (const [key, value] of new Headers(init.headers).entries()) {
      headers.set(key, value);
    }
  }
  headers.set(CSRF_HEADER, csrfToken ?? "");

  return new Request(input, { ...init, headers });
};

const fetchWithConnectionError: typeof fetch = async (...args) => {
  const [input, init] = args;
  const requestMethod =
    input instanceof Request ? input.method : (init?.method ?? "GET");
  const request =
    csrfToken !== null &&
    csrfProtectedMethods.has(requestMethod.toUpperCase()) &&
    !isLoginRequest(input)
      ? addCsrfHeader(input, init)
      : undefined;

  try {
    const response =
      request === undefined
        ? await globalThis.fetch(...args)
        : await globalThis.fetch(request);

    if (response.status === 401 && !isLoginRequest(input)) {
      clearCsrfToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_SESSION_LOST_EVENT));
      }
    }

    return response;
  } catch (error: unknown) {
    throw new ApiConnectionError(error);
  }
};

client.setConfig({
  baseUrl: env.VITE_API_URL,
  credentials: "include",
  fetch: fetchWithConnectionError,
});

export { client as apiClient } from "@/generated/hey-api/client.gen";
