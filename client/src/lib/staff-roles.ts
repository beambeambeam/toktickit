import type { UserRole } from "@/generated/hey-api/types.gen";

export const STAFF_ROLES: readonly UserRole[] = ["IT Staff", "Administrator"];

export const isStaffRole = (role: UserRole): boolean =>
  STAFF_ROLES.includes(role);
