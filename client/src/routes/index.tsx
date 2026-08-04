import { createFileRoute } from "@tanstack/react-router";

export const HomePage = () => (
  <main className="page">
    <h1>Welcome Home!</h1>
  </main>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
