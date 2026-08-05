import { createFileRoute } from "@tanstack/react-router";

export const HomePage = () => (
  <main className="page">
    <div className="container py-5 text-center">
      <h1>Welcome Home!</h1>
    </div>
  </main>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
