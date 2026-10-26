import {
  createFileRoute,
  useLocation,
  useSearch,
} from "@tanstack/react-router";

import {
  hasIgnoredTimeWindow,
  parseStaffTicketSearch,
} from "@/lib/ticket-search";
import { StaffTicketQueuePage } from "@/pages/staff-ticket-queue-page";

const StaffTicketsRoute = () => {
  const search = useSearch({ from: "/staff/tickets/" });
  const searchStr = useLocation({ select: (location) => location.searchStr });
  return (
    <StaffTicketQueuePage
      ignoredTimeWindow={hasIgnoredTimeWindow(searchStr)}
      initialFilters={search}
    />
  );
};

export const Route = createFileRoute("/staff/tickets/")({
  component: StaffTicketsRoute,
  validateSearch: parseStaffTicketSearch,
});
