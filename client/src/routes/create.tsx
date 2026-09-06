import { createFileRoute } from "@tanstack/react-router";

import { CreateTicketPage } from "@/pages/create-ticket-page";

export const Route = createFileRoute("/create")({
  component: CreateTicketPage,
});
