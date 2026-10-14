import { createFileRoute, useLocation } from "@tanstack/react-router";

import { parseActionAnchor } from "@/components/actions-taken-anchor";
import { useAuth } from "@/context/auth";
import { RequesterTicketDetailPage } from "@/pages/requester-ticket-detail-page";
import { StaffTicketDetailPage } from "@/pages/staff-ticket-detail-page";

const TicketDetailRouteView = () => {
  // oxlint-disable-next-line no-use-before-define -- TanStack Router route declaration follows the component.
  const { ticketId } = Route.useParams();

  const hash = useLocation({ select: (location) => location.hash });

  const { user } = useAuth();
  if (user?.role === "IT Staff" || user?.role === "Administrator") {
    return (
      <StaffTicketDetailPage
        focusActionId={parseActionAnchor(hash)}
        ticketId={ticketId}
      />
    );
  }

  return <RequesterTicketDetailPage ticketId={ticketId} />;
};

export const Route = createFileRoute("/tickets/$ticketId")({
  component: TicketDetailRouteView,
});
