import { createFileRoute } from "@tanstack/react-router";

import { UserManagementPage } from "@/pages/user-management-page";

export const Route = createFileRoute("/users")({
  component: UserManagementPage,
});
