import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/context/auth";
import { RequesterTicketDetailPage } from "@/pages/requester-ticket-detail-page";
import { StaffTicketDetailPage } from "@/pages/staff-ticket-detail-page";

const TicketDetailRouteView = () => {
  // oxlint-disable-next-line no-use-before-define -- TanStack Router route declaration follows the component.
  const { ticketId } = Route.useParams();

  const { user } = useAuth();
  if (user?.role === "IT Staff" || user?.role === "Administrator") {
    return <StaffTicketDetailPage ticketId={ticketId} />;
  }

  return <RequesterTicketDetailPage ticketId={ticketId} />;
};

export const Route = createFileRoute("/tickets/$ticketId")({
  component: TicketDetailRouteView,
});
