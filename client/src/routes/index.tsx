import { createFileRoute } from "@tanstack/react-router";

import { RequesterSelectionPage } from "@/pages/requester-selection-page";

export const Route = createFileRoute("/")({
  component: RequesterSelectionPage,
});
