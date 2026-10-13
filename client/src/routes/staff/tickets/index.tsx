import { createFileRoute, useSearch } from "@tanstack/react-router";

import { parseStaffTicketSearch } from "@/lib/ticket-search";
import { StaffTicketQueuePage } from "@/pages/staff-ticket-queue-page";

const StaffTicketsRoute = () => {
  const search = useSearch({ from: "/staff/tickets/" });
  return <StaffTicketQueuePage initialFilters={search} />;
};

export const Route = createFileRoute("/staff/tickets/")({
  component: StaffTicketsRoute,
  validateSearch: parseStaffTicketSearch,
});
