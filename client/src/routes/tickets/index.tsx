import { createFileRoute } from "@tanstack/react-router";

import { MyTicketsPage } from "@/pages/my-tickets-page";

export const Route = createFileRoute("/tickets/")({
  component: MyTicketsPage,
});
