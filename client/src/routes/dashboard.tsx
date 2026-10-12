import { createFileRoute } from "@tanstack/react-router";

import { RequesterDashboardPage } from "@/pages/requester-dashboard-page";

export const Route = createFileRoute("/dashboard")({
  component: RequesterDashboardPage,
});
