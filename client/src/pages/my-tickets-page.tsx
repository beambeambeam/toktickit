import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SubmitEvent } from "react";

import {
  activeCategoriesQueryOptions,
  relatedSystemsQueryOptions,
  ticketsQueryOptions,
} from "@/api/lab2-options";
import type { TicketListParams } from "@/api/requester";
import { AppShell, RequesterRequired } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { useRequester } from "@/context/requester";
import type { DevelopmentRequester } from "@/generated/hey-api/types.gen";
import { isRequestedPriority } from "@/lib/ticket-priorities";

const initialParams: TicketListParams = {
  page: 1,
  pageSize: 10,
  sortBy: "updatedAt",
  sortDirection: "desc",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

type TicketSortField = NonNullable<TicketListParams["sortBy"]>;
type TicketSortDirection = NonNullable<TicketListParams["sortDirection"]>;

const isTicketSortField = (value: string): value is TicketSortField =>
  value === "ticketNumber" ||
  value === "ticketDate" ||
  value === "summary" ||
  value === "requestedPriority" ||
  value === "currentStatus" ||
  value === "updatedAt";

const isTicketSortDirection = (value: string): value is TicketSortDirection =>
  value === "asc" || value === "desc";

const parseSort = (
  value: string
): { sortBy: TicketSortField; sortDirection: TicketSortDirection } => {
  const [sortBy, sortDirection] = value.split(":");

  if (
    sortBy !== undefined &&
    isTicketSortField(sortBy) &&
    sortDirection !== undefined &&
    isTicketSortDirection(sortDirection)
  ) {
    return { sortBy, sortDirection };
  }

  return { sortBy: "updatedAt", sortDirection: "desc" };
};

const parsePageSize = (value: string): 10 | 25 | 50 => {
  if (value === "25") {
    return 25;
  }

  if (value === "50") {
    return 50;
  }

  return 10;
};

const hasTicketFilters = (params: TicketListParams) =>
  (params.search !== undefined && params.search.length > 0) ||
  params.categoryId !== undefined ||
  params.relatedSystemId !== undefined ||
  params.requestedPriority !== undefined ||
  params.currentStatus !== undefined;

type PageToken = number | "ellipsis-before" | "ellipsis-after";

const getPageTokens = (
  totalPages: number,
  currentPage: number
): PageToken[] => {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const firstVisiblePage = Math.max(2, currentPage - 1);
  const lastVisiblePage = Math.min(totalPages - 1, currentPage + 1);
  const pages: PageToken[] = [1];

  if (firstVisiblePage > 2) {
    pages.push("ellipsis-before");
  }

  for (
    let pageNumber = firstVisiblePage;
    pageNumber <= lastVisiblePage;
    pageNumber += 1
  ) {
    pages.push(pageNumber);
  }

  if (lastVisiblePage < totalPages - 1) {
    pages.push("ellipsis-after");
  }

  pages.push(totalPages);
  return pages;
};

// oxlint-disable-next-line complexity -- this page renders the documented loading, error, empty, and data states.
const MyTicketsContent = ({
  requester,
}: {
  requester: DevelopmentRequester;
}) => {
  const navigate = useNavigate();
  const [params, setParams] = useState<TicketListParams>(initialParams);
  const [searchDraft, setSearchDraft] = useState("");
  const requesterId = requester.id;

  const categoriesQuery = useQuery(activeCategoriesQueryOptions());
  const relatedSystemsQuery = useQuery(relatedSystemsQueryOptions());
  const ticketsQuery = useQuery({
    ...ticketsQueryOptions(requesterId ?? 0, params),
    enabled: requesterId !== undefined,
  });

  const updateParams = (change: Partial<TicketListParams>) => {
    setParams((current) => ({ ...current, ...change, page: 1 }));
  };

  const clearFilters = () => {
    setSearchDraft("");
    setParams(initialParams);
  };

  const submitSearch = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = searchDraft.trim();
    updateParams({ search: search.length > 0 ? search : undefined });
  };

  const data = ticketsQuery.isError ? undefined : ticketsQuery.data;
  const hasFilters = hasTicketFilters(params);
  const hasActiveFilters = hasFilters || searchDraft.trim().length > 0;
  const showEmpty =
    data !== undefined &&
    !ticketsQuery.isError &&
    data.totalItems === 0 &&
    !hasFilters;
  const showNoResults =
    data !== undefined &&
    !ticketsQuery.isError &&
    data.totalItems === 0 &&
    hasFilters;
  const showPageEmpty =
    data !== undefined &&
    !ticketsQuery.isError &&
    data.items.length === 0 &&
    data.totalItems > 0;
  const showLoadedTickets =
    data !== undefined && !ticketsQuery.isError && data.items.length > 0;
  const page = data?.page ?? params.page ?? 1;
  const totalPages = data?.totalPages ?? 0;
  const pageTokens = getPageTokens(totalPages, page);
  const hasFilterDataError =
    categoriesQuery.isError || relatedSystemsQuery.isError;

  const retryFilterData = () => {
    void categoriesQuery.refetch();
    void relatedSystemsQuery.refetch();
  };

  return (
    <AppShell eyebrow="Requester workspace" title="My Tickets">
      <div className="page-actions">
        <p className="page-description">
          View and track support requests owned by {requester.displayName}.
        </p>
        <div className="button-row">
          <button
            className="button button-tertiary"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
            type="button"
          >
            ↻ Clear Filters
          </button>
          <button
            className="button button-primary"
            onClick={() => void navigate({ to: "/create" })}
            type="button"
          >
            + Create Ticket
          </button>
        </div>
      </div>

      <section className="surface-card filter-card" aria-label="Ticket filters">
        <form className="filter-grid" onSubmit={submitSearch}>
          <div className="search-field">
            <label htmlFor="ticket-search">Search</label>
            <div className="input-with-icon">
              <span aria-hidden="true">⌕</span>
              <input
                id="ticket-search"
                onChange={(event) => {
                  setSearchDraft(event.target.value);
                }}
                placeholder="Search Ticket Number, summary, or description"
                value={searchDraft}
              />
            </div>
          </div>
          <div className="filter-field">
            <label htmlFor="ticket-category-filter">Category</label>
            <select
              disabled={categoriesQuery.isPending || categoriesQuery.isError}
              id="ticket-category-filter"
              onChange={(event) => {
                updateParams({
                  categoryId: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                });
              }}
              value={params.categoryId ?? ""}
            >
              <option value="">All Categories</option>
              {categoriesQuery.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="ticket-system-filter">Related System</label>
            <select
              disabled={
                relatedSystemsQuery.isPending || relatedSystemsQuery.isError
              }
              id="ticket-system-filter"
              onChange={(event) => {
                updateParams({
                  relatedSystemId: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                });
              }}
              value={params.relatedSystemId ?? ""}
            >
              <option value="">All Systems</option>
              {relatedSystemsQuery.data?.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="ticket-priority-filter">Requested Priority</label>
            <select
              id="ticket-priority-filter"
              onChange={(event) => {
                const requestedPriority = event.target.value;
                updateParams({
                  requestedPriority:
                    requestedPriority.length > 0 &&
                    isRequestedPriority(requestedPriority)
                      ? requestedPriority
                      : undefined,
                });
              }}
              value={params.requestedPriority ?? ""}
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="ticket-status-filter">Current Status</label>
            <select
              id="ticket-status-filter"
              onChange={(event) => {
                updateParams({
                  currentStatus: event.target.value ? "New" : undefined,
                });
              }}
              value={params.currentStatus ?? ""}
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="ticket-sort">Sort</label>
            <select
              id="ticket-sort"
              onChange={(event) => {
                updateParams(parseSort(event.target.value));
              }}
              value={`${params.sortBy ?? "updatedAt"}:${params.sortDirection ?? "desc"}`}
            >
              <option value="updatedAt:desc">Last Updated (newest)</option>
              <option value="updatedAt:asc">Last Updated (oldest)</option>
              <option value="ticketDate:desc">Ticket Date (newest)</option>
              <option value="ticketDate:asc">Ticket Date (oldest)</option>
              <option value="ticketNumber:asc">Ticket Number (A–Z)</option>
              <option value="ticketNumber:desc">Ticket Number (Z–A)</option>
              <option value="summary:asc">Summary (A–Z)</option>
              <option value="summary:desc">Summary (Z–A)</option>
              <option value="requestedPriority:asc">
                Requested Priority (Low–Urgent)
              </option>
              <option value="requestedPriority:desc">
                Requested Priority (Urgent–Low)
              </option>
              <option value="currentStatus:asc">Current Status (A–Z)</option>
              <option value="currentStatus:desc">Current Status (Z–A)</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="ticket-page-size">Per page</label>
            <select
              id="ticket-page-size"
              onChange={(event) => {
                updateParams({
                  pageSize: parsePageSize(event.target.value),
                });
              }}
              value={params.pageSize ?? 10}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            className="button button-secondary filter-submit"
            type="submit"
          >
            Search
          </button>
        </form>
        {hasFilterDataError ? (
          <div
            className="feedback feedback-warning filter-feedback"
            role="alert"
          >
            <strong>Some filter options are unavailable.</strong>
            <span>
              Retry to load the latest Category and Related System options.
            </span>
            <button
              className="button button-secondary"
              onClick={retryFilterData}
              type="button"
            >
              Retry filter options
            </button>
          </div>
        ) : null}
      </section>

      <section
        className="surface-card ticket-list-card"
        aria-busy={ticketsQuery.isFetching}
        aria-labelledby="ticket-list-heading"
      >
        <div className="section-heading list-heading">
          <div>
            <p className="eyebrow">Owned requests</p>
            <h2 id="ticket-list-heading">Your tickets</h2>
          </div>
          {data ? (
            <span className="result-count">{data.totalItems} total</span>
          ) : null}
        </div>

        <div
          aria-atomic="true"
          aria-live="polite"
          className="list-status"
          role="status"
        >
          {ticketsQuery.isPending ? (
            <p className="loading-line">Loading your Tickets…</p>
          ) : null}
          {ticketsQuery.isFetching && !ticketsQuery.isPending ? (
            <p className="loading-line">Updating results…</p>
          ) : null}
          {data && !ticketsQuery.isFetching ? (
            <p className="visually-hidden">{data.totalItems} Tickets loaded.</p>
          ) : null}
        </div>

        {ticketsQuery.isError ? (
          <div className="feedback feedback-error" role="alert">
            <strong>Could not load My Tickets.</strong>
            <span>
              {ticketsQuery.error instanceof Error
                ? ticketsQuery.error.message
                : "Try again."}
            </span>
            <button
              className="button button-secondary"
              onClick={() => void ticketsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {showEmpty ? (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-icon">
              ▤
            </div>
            <h3>No Tickets yet</h3>
            <p>{requester.displayName} has not created a support request.</p>
            <button
              className="button button-primary"
              onClick={() => void navigate({ to: "/create" })}
              type="button"
            >
              Create your first Ticket
            </button>
          </div>
        ) : null}

        {showNoResults ? (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-icon">
              ⌕
            </div>
            <h3>No matching Tickets</h3>
            <p>Try a different search or clear the active filters.</p>
            <button
              className="button button-secondary"
              onClick={clearFilters}
              type="button"
            >
              Clear Filters
            </button>
          </div>
        ) : null}

        {showPageEmpty ? (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-icon">
              ▤
            </div>
            <h3>No Tickets on this page</h3>
            <p>Use the page controls to return to a page with Tickets.</p>
            <button
              className="button button-secondary"
              disabled={page <= 1}
              onClick={() => {
                setParams((current) => ({ ...current, page: page - 1 }));
              }}
              type="button"
            >
              ← Previous page
            </button>
          </div>
        ) : null}

        {showLoadedTickets ? (
          <>
            <div className="ticket-table-wrap">
              <table className="ticket-table">
                <caption className="visually-hidden">
                  Tickets owned by {requester.displayName}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Ticket No.</th>
                    <th scope="col">Ticket Date</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Category</th>
                    <th scope="col">Requested Priority</th>
                    <th scope="col">Current Status</th>
                    <th scope="col">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <Link
                          className="ticket-number"
                          params={{ ticketId: ticket.id.toString() }}
                          to="/tickets/$ticketId"
                        >
                          {ticket.ticketNumber}
                        </Link>
                      </td>
                      <td>{formatDate(ticket.ticketDate)}</td>
                      <td className="summary-cell">{ticket.summary}</td>
                      <td>{ticket.category.name}</td>
                      <td>
                        <StatusBadge
                          kind="priority"
                          value={ticket.requestedPriority}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          kind="status"
                          value={ticket.currentStatus}
                        />
                      </td>
                      <td>{formatDate(ticket.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ticket-cards">
              {data.items.map((ticket) => (
                <article className="ticket-card" key={ticket.id}>
                  <div className="ticket-card-heading">
                    <Link
                      className="ticket-number"
                      params={{ ticketId: ticket.id.toString() }}
                      to="/tickets/$ticketId"
                    >
                      {ticket.ticketNumber}
                    </Link>
                    <StatusBadge kind="status" value={ticket.currentStatus} />
                  </div>
                  <h3>{ticket.summary}</h3>
                  <dl>
                    <div>
                      <dt>Ticket Date</dt>
                      <dd>{formatDate(ticket.ticketDate)}</dd>
                    </div>
                    <div>
                      <dt>Category</dt>
                      <dd>{ticket.category.name}</dd>
                    </div>
                    <div>
                      <dt>Related System</dt>
                      <dd>{ticket.relatedSystem.name}</dd>
                    </div>
                    <div>
                      <dt>Requested Priority</dt>
                      <dd>
                        <StatusBadge
                          kind="priority"
                          value={ticket.requestedPriority}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Last Updated</dt>
                      <dd>{formatDate(ticket.updatedAt)}</dd>
                    </div>
                  </dl>
                  <Link
                    className="button button-secondary"
                    params={{ ticketId: ticket.id.toString() }}
                    to="/tickets/$ticketId"
                  >
                    Open Ticket
                  </Link>
                </article>
              ))}
            </div>
            <nav className="pagination" aria-label="Ticket pages">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => {
                  setParams((current) => ({ ...current, page: page - 1 }));
                }}
                type="button"
              >
                ← Previous
              </button>
              <span>
                Page {page} of {totalPages > 0 ? totalPages : 1}
              </span>
              <div className="pagination-pages">
                {pageTokens.map((pageToken) =>
                  typeof pageToken === "number" ? (
                    <button
                      aria-current={pageToken === page ? "page" : undefined}
                      aria-label={`Go to page ${pageToken}`}
                      className="button button-secondary pagination-page"
                      key={pageToken}
                      onClick={() => {
                        setParams((current) => ({
                          ...current,
                          page: pageToken,
                        }));
                      }}
                      type="button"
                    >
                      {pageToken}
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="pagination-ellipsis"
                      key={pageToken}
                    >
                      …
                    </span>
                  )
                )}
              </div>
              <button
                className="button button-secondary"
                disabled={page >= totalPages}
                onClick={() => {
                  setParams((current) => ({ ...current, page: page + 1 }));
                }}
                type="button"
              >
                Next →
              </button>
            </nav>
          </>
        ) : null}
      </section>
    </AppShell>
  );
};

export const MyTicketsPage = () => {
  const { requester } = useRequester();

  if (requester === null) {
    return <RequesterRequired />;
  }

  return <MyTicketsContent key={requester.id} requester={requester} />;
};
