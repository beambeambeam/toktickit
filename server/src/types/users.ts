export type UserRoleValue = "Requester" | "ITStaff" | "Administrator";

export type UserRoleLabel = "Requester" | "IT Staff" | "Administrator";

export const toUserRoleLabel = (role: UserRoleValue): UserRoleLabel =>
  role === "ITStaff" ? "IT Staff" : role;

export interface UserListQuery {
  role?: UserRoleValue;
  search?: string;
}

export interface CreateUserInput {
  displayName: string;
  email: string;
  initialPassword: string;
  isActive: boolean;
  role: UserRoleValue;
}

export interface UpdateUserInput {
  displayName?: string;
  email?: string;
  isActive?: boolean;
  role?: UserRoleValue;
}

export interface ResetInitialPasswordInput {
  confirmed: true;
  initialPassword: string;
}
