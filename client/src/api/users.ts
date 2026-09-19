import { getCsrfToken, apiClient } from "@/api/client";
import { ApiRequestError, invalidApiResponse, unwrap } from "@/api/errors";
import {
  createApiUser,
  getApiUser,
  getApiUsers,
  resetApiUserInitialPassword,
  updateApiUser,
} from "@/generated/hey-api/sdk.gen";
import type {
  CreateUserRequest,
  InitialPasswordResetRequest,
  User,
  UserListResponse,
  UserRole,
  UpdateUserRequest,
} from "@/generated/hey-api/types.gen";

export type { User, UserRole } from "@/generated/hey-api/types.gen";

export interface UserListParams {
  role?: UserRole;
  search?: string;
}

export type CreateUserInput = CreateUserRequest;
export type UpdateUserInput = UpdateUserRequest;
export type ResetInitialPasswordInput = InitialPasswordResetRequest;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUserRole = (value: unknown): value is UserRole =>
  value === "Requester" || value === "IT Staff" || value === "Administrator";

const isUser = (value: unknown): value is User =>
  isRecord(value) &&
  typeof value.id === "number" &&
  Number.isSafeInteger(value.id) &&
  value.id > 0 &&
  typeof value.displayName === "string" &&
  typeof value.email === "string" &&
  isUserRole(value.role) &&
  typeof value.isActive === "boolean" &&
  typeof value.mustChangePassword === "boolean" &&
  typeof value.createdAt === "string" &&
  typeof value.updatedAt === "string";

const isUserListResponse = (value: unknown): value is UserListResponse =>
  isRecord(value) && Array.isArray(value.items) && value.items.every(isUser);

const requireUserList = (value: unknown): User[] => {
  if (!isUserListResponse(value)) {
    throw invalidApiResponse("The API returned an invalid User-list response.");
  }

  return value.items;
};

const requireCreatedUser = (value: unknown): User => {
  if (!isRecord(value) || !isUser(value.user)) {
    throw invalidApiResponse("The API returned an invalid User response.");
  }

  return value.user;
};

const requireUserResponse = (value: unknown): User => {
  if (!isUser(value)) {
    throw invalidApiResponse("The API returned an invalid User response.");
  }

  return value;
};

const requireUpdatedUser = (value: unknown): User => {
  if (!isRecord(value) || !isUser(value.user)) {
    throw invalidApiResponse("The API returned an invalid User response.");
  }

  return value.user;
};

export const getUsers = async (
  params: UserListParams = {},
  signal?: AbortSignal
): Promise<User[]> =>
  requireUserList(
    await unwrap(
      getApiUsers({
        client: apiClient,
        query: params,
        signal,
      })
    )
  );

export const createUser = async (
  input: CreateUserInput,
  signal?: AbortSignal
): Promise<User> =>
  requireCreatedUser(
    await unwrap(
      createApiUser({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        signal,
      })
    )
  );

export const getUser = async (
  userId: number,
  signal?: AbortSignal
): Promise<User> =>
  requireUserResponse(
    await unwrap(
      getApiUser({
        client: apiClient,
        path: { userId },
        signal,
      })
    )
  );

export const updateUser = async (
  userId: number,
  input: UpdateUserInput,
  signal?: AbortSignal
): Promise<User> =>
  requireUpdatedUser(
    await unwrap(
      updateApiUser({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        path: { userId },
        signal,
      })
    )
  );

export const resetUserInitialPassword = async (
  userId: number,
  input: ResetInitialPasswordInput,
  signal?: AbortSignal
): Promise<User> =>
  requireUpdatedUser(
    await unwrap(
      resetApiUserInitialPassword({
        body: input,
        client: apiClient,
        headers: csrfHeaders(),
        path: { userId },
        signal,
      })
    )
  );
