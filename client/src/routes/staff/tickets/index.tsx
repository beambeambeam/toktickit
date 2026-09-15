import { createFileRoute } from "@tanstack/react-router";

import { StaffTicketQueuePage } from "@/pages/staff-ticket-queue-page";

export const Route = createFileRoute("/staff/tickets/")({
  component: StaffTicketQueuePage,
});
