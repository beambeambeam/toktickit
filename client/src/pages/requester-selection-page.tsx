import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ApiConnectionError } from "@/api/client";
import { developmentRequestersQueryOptions } from "@/api/lab2-options";
import { AppShell } from "@/components/app-shell";
import { useRequester } from "@/context/requester";
import { cn } from "@/lib/class-names";

const requesterErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load active Development Requesters.";
};

const SelectionBrand = () => (
  <header className="selection-header">
    <div className="selection-header-inner">
      <span className="brand">
        <span aria-hidden="true" className="brand-mark">
          ◷
        </span>
        <span>TokTickIT</span>
      </span>
      <span className="testing-chip">Lab 2 testing context</span>
    </div>
  </header>
);

const SelectionHeading = ({ inShell }: { inShell: boolean }) => {
  const Heading = inShell ? "h2" : "h1";

  return <Heading id="selection-title">Select Development Requester</Heading>;
};

export const RequesterSelectionPage = () => {
  const navigate = useNavigate();
  const { clearRequester, requester, selectRequester } = useRequester();
  const requestersQuery = useQuery(developmentRequestersQueryOptions());
  const [selectedId, setSelectedId] = useState(
    requester === null ? "" : requester.id.toString()
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const selectedRequester = requestersQuery.data?.find(
    (item) => item.id.toString() === selectedId
  );
  const isEmpty =
    requestersQuery.isSuccess && requestersQuery.data.length === 0;

  const continueToTickets = () => {
    setHasSubmitted(true);

    if (selectedRequester === undefined) {
      return;
    }

    selectRequester(selectedRequester);
    void navigate({ to: "/tickets" });
  };

  const cancelSelection = () => {
    if (requester !== null) {
      void navigate({ to: "/tickets" });
      return;
    }

    clearRequester();
  };

  const inShell = requester !== null;
  const content = (
    <section className="selection-card" aria-labelledby="selection-title">
      <div className="selection-card-header">
        <div aria-hidden="true" className="selection-icon">
          ♙
        </div>
        <SelectionHeading inShell={inShell} />
        <p>
          Choose a Development Requester to simulate the current requester
          context for Lab 2.
          <br />
          This is for testing only and is not a login screen.
        </p>
      </div>

      <div className="selection-card-body">
        <div
          className={cn(
            "form-field",
            hasSubmitted && selectedRequester === undefined && "has-error"
          )}
        >
          <label htmlFor="development-requester">
            Development Requester{" "}
            <span aria-hidden="true" className="required-mark">
              *
            </span>
          </label>
          <select
            aria-describedby={
              hasSubmitted && selectedRequester === undefined
                ? "development-requester-error"
                : undefined
            }
            aria-invalid={hasSubmitted && selectedRequester === undefined}
            disabled={
              requestersQuery.isPending || isEmpty || requestersQuery.isError
            }
            id="development-requester"
            onChange={(event) => {
              setHasSubmitted(false);
              setSelectedId(event.target.value);
            }}
            value={selectedId}
          >
            <option value="">Choose an active Development Requester</option>
            {requestersQuery.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName} — {item.email}
              </option>
            ))}
          </select>
          {hasSubmitted && selectedRequester === undefined ? (
            <p
              className="field-error"
              id="development-requester-error"
              role="alert"
            >
              <span aria-hidden="true">!</span> Select an active Development
              Requester to continue.
            </p>
          ) : null}
        </div>

        <div className="info-callout">
          <span aria-hidden="true" className="callout-icon">
            ⓘ
          </span>
          <p>Only active Development Requesters are shown.</p>
        </div>

        <div className="lab-callout">
          <span aria-hidden="true" className="callout-icon">
            ◇
          </span>
          <div>
            <strong>Lab 3 identity flow</strong>
            <p>
              This temporary context will be replaced by the Lab 3 identity
              flow.
            </p>
          </div>
        </div>

        <div aria-live="polite" className="status-region" role="status">
          {requestersQuery.isPending ? (
            <p>Loading active Development Requesters…</p>
          ) : null}
          {requestersQuery.isError ? (
            <div className="feedback feedback-error" role="alert">
              <strong>Could not load Requesters.</strong>
              <span>{requesterErrorMessage(requestersQuery.error)}</span>
              <button
                className="button button-secondary"
                onClick={() => void requestersQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : null}
          {isEmpty ? (
            <div className="feedback feedback-warning" role="alert">
              <strong>No active Development Requesters are available.</strong>
              <span>Seed an active test context, then retry.</span>
              <button
                className="button button-secondary"
                onClick={() => void requestersQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="selection-card-actions">
        <button
          className="button button-secondary"
          onClick={cancelSelection}
          type="button"
        >
          {requester === null ? "Cancel" : "Back"}
        </button>
        <button
          className="button button-primary"
          disabled={
            selectedRequester === undefined || requestersQuery.isPending
          }
          onClick={continueToTickets}
          type="button"
        >
          Continue <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );

  return requester === null ? (
    <div className="selection-page">
      <SelectionBrand />
      <main className="selection-main">{content}</main>
    </div>
  ) : (
    <AppShell eyebrow="Context" title="Select Development Requester">
      {content}
    </AppShell>
  );
};
