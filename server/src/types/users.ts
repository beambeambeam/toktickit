export type UserRoleValue = "Requester" | "ITStaff" | "Administrator";

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
