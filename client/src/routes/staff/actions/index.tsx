import { createFileRoute } from "@tanstack/react-router";

import { StaffMyActionsPage } from "@/pages/staff-my-actions-page";

export const Route = createFileRoute("/staff/actions/")({
  component: StaffMyActionsPage,
});
