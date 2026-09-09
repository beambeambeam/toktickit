import {
  clearCsrfToken,
  getCsrfToken,
  setCsrfToken,
  apiClient,
} from "@/api/client";
import { ApiRequestError, invalidApiResponse, unwrap } from "@/api/errors";
import {
  getApiAuthMe,
  postApiAuthChangePassword,
  postApiAuthLogin,
  postApiAuthLogout,
} from "@/generated/hey-api/sdk.gen";
import type {
  AuthResponse as GeneratedAuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  User,
} from "@/generated/hey-api/types.gen";

export type UserRole = User["role"];
export type AuthUser = User;
export type AuthResponse = GeneratedAuthResponse;
export type LoginInput = LoginRequest;
export type ChangePasswordInput = ChangePasswordRequest;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRole = (value: unknown): value is UserRole =>
  value === "Requester" || value === "IT Staff" || value === "Administrator";

const isAuthUser = (value: unknown): value is AuthUser =>
  isRecord(value) &&
  typeof value.createdAt === "string" &&
  typeof value.displayName === "string" &&
  typeof value.email === "string" &&
  typeof value.id === "number" &&
  Number.isSafeInteger(value.id) &&
  value.id > 0 &&
  typeof value.isActive === "boolean" &&
  typeof value.mustChangePassword === "boolean" &&
  isRole(value.role) &&
  typeof value.updatedAt === "string";

const isAuthResponse = (value: unknown): value is AuthResponse =>
  isRecord(value) &&
  isAuthUser(value.user) &&
  typeof value.csrfToken === "string" &&
  value.csrfToken.length > 0;

const requireAuthResponse = (value: unknown): AuthResponse => {
  if (!isAuthResponse(value)) {
    throw invalidApiResponse(
      "The API returned an invalid authentication response."
    );
  }

  return value;
};

const storeSession = (response: AuthResponse): AuthResponse => {
  setCsrfToken(response.csrfToken);
  return response;
};

const csrfHeaders = (): { "X-CSRF-Token": string } => {
  const token = getCsrfToken();
  if (token === null) {
    throw new ApiRequestError(
      401,
      "Sign in to continue.",
      "AUTHENTICATION_REQUIRED"
    );
  }

  return { "X-CSRF-Token": token };
};

export const login = async (
  input: LoginInput,
  signal?: AbortSignal
): Promise<AuthResponse> =>
  storeSession(
    requireAuthResponse(
      await unwrap(
        postApiAuthLogin({
          body: input,
          client: apiClient,
          signal,
        })
      )
    )
  );

export const getCurrentAuth = async (
  signal?: AbortSignal
): Promise<AuthResponse> =>
  storeSession(
    requireAuthResponse(
      await unwrap(
        getApiAuthMe({
          client: apiClient,
          signal,
        })
      )
    )
  );

export const changePassword = async (
  input: ChangePasswordInput,
  signal?: AbortSignal
): Promise<AuthResponse> =>
  storeSession(
    requireAuthResponse(
      await unwrap(
        postApiAuthChangePassword({
          body: input,
          client: apiClient,
          headers: csrfHeaders(),
          signal,
        })
      )
    )
  );

export const logout = async (signal?: AbortSignal): Promise<void> => {
  await unwrap(
    postApiAuthLogout({
      body: {},
      client: apiClient,
      headers: csrfHeaders(),
      signal,
    })
  );
  clearCsrfToken();
};
