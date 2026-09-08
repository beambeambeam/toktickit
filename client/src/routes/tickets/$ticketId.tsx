import { createFileRoute } from "@tanstack/react-router";

import { RequesterTicketDetailPage } from "@/pages/requester-ticket-detail-page";

const TicketDetailRouteView = () => {
  // oxlint-disable-next-line no-use-before-define -- TanStack Router route declaration follows the component.
  const { ticketId } = Route.useParams();
  return <RequesterTicketDetailPage ticketId={ticketId} />;
};

export const Route = createFileRoute("/tickets/$ticketId")({
  component: TicketDetailRouteView,
});
