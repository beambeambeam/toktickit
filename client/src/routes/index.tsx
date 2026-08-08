import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { categoriesQueryOptions } from "@/api/categories";
import { ApiConnectionError } from "@/api/client";
import { healthQueryOptions } from "@/api/health";

const getHealthErrorMessage = (error: unknown) => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to TokTickIT API";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Health request failed";
};

export const HomePage = () => {
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const healthQuery = useQuery(healthQueryOptions());

  let statusContent: ReactNode = null;
  let categoryContent: ReactNode = null;

  if (healthQuery.isFetching) {
    statusContent = <p className="mb-0">System Status: Checking...</p>;
  } else if (healthQuery.isSuccess) {
    statusContent = (
      <>
        <p className="mb-2">System Status: Online</p>
        <p className="mb-0">{healthQuery.data.service}</p>
      </>
    );
  } else if (healthQuery.isError) {
    statusContent = (
      <>
        <p className="mb-2">System Status: Offline</p>
        <p className="mb-0">{getHealthErrorMessage(healthQuery.error)}</p>
      </>
    );
  }

  if (categoriesQuery.isFetching) {
    categoryContent = (
      <p className="mb-0 mt-3">Loading supported request categories...</p>
    );
  } else if (categoriesQuery.isSuccess) {
    categoryContent = (
      <section className="mt-3">
        <h2>Supported Request Categories</h2>
        <ol>
          {categoriesQuery.data.map((category) => (
            <li key={category.id}>{category.name}</li>
          ))}
        </ol>
      </section>
    );
  }

  const checkSystem = () => {
    void healthQuery.refetch();
    void categoriesQuery.refetch();
  };

  return (
    <main className="page">
      <div className="container py-5">
        <section className="card w-100">
          <div className="card-body">
            <h1 className="card-title">TokTickIT IT Service Desk</h1>
            <button
              className="btn btn-primary"
              disabled={healthQuery.isFetching || categoriesQuery.isFetching}
              onClick={checkSystem}
              type="button"
            >
              [ Check System ]
            </button>
            <div
              aria-atomic="true"
              aria-live="polite"
              className="mt-3"
              role="status"
            >
              {statusContent}
              {categoryContent}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export const Route = createFileRoute("/")({
  component: HomePage,
});
