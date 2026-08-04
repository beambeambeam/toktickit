import { createFileRoute } from "@tanstack/react-router";

const Index = () => (
  <main className="page">
    <h1>Welcome Home!</h1>
  </main>
);

export const Route = createFileRoute("/")({
  component: Index,
});
