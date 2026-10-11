import { createFileRoute, useSearch } from "@tanstack/react-router";

import type { TicketScope } from "@/generated/hey-api/types.gen";
import { MyTicketsPage } from "@/pages/my-tickets-page";
import type { MyTicketsInitialFilters } from "@/pages/my-tickets-page";

const ticketScopes: ReadonlySet<string> = new Set([
  "active",
  "waiting-for-requester",
  "recently-updated",
  "recently-resolved",
]);

const isTicketScope = (value: unknown): value is TicketScope =>
  typeof value === "string" && ticketScopes.has(value);

const TicketsRoute = () => {
  const search = useSearch({ from: "/tickets/" });
  return <MyTicketsPage initialFilters={search} />;
};

export const Route = createFileRoute("/tickets/")({
  component: TicketsRoute,
  validateSearch: (
    search: Record<string, unknown>
  ): MyTicketsInitialFilters => {
    const from =
      typeof search.from === "string" && search.from.length > 0
        ? search.from
        : undefined;
    const scope = isTicketScope(search.scope) ? search.scope : undefined;
    const through =
      typeof search.through === "string" && search.through.length > 0
        ? search.through
        : undefined;

    return {
      ...(from === undefined ? {} : { from }),
      ...(scope === undefined ? {} : { scope }),
      ...(through === undefined ? {} : { through }),
    };
  },
});
