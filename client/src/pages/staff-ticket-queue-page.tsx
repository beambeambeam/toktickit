import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  RefreshIcon,
  Search01Icon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { SubmitEvent } from "react";

import type { AuthUser } from "@/api/auth";
import {
  activeCategoriesQueryOptions,
  relatedSystemsQueryOptions,
} from "@/api/query-options";
import type {
  StaffTicketListParams,
  StaffTicketOwnerFilter,
} from "@/api/staff";
import {
  staffOwnersQueryOptions,
  staffTicketsQueryOptions,
} from "@/api/staff-query-options";
import { AccessDenied, AppShell, AuthRequired } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import { isRequestedPriority } from "@/lib/ticket-priorities";
import { currentStatuses, isCurrentStatus } from "@/lib/ticket-statuses";

const initialParams: StaffTicketListParams = {
  page: 1,
  pageSize: 20,
  sortBy: "updatedAt",
  sortDirection: "desc",
};

const queueSortFields = [
  "ticketNumber",
  "ticketDate",
  "itPriority",
  "updatedAt",
] as const;

type QueueSortField = (typeof queueSortFields)[number];
type QueueSortDirection = NonNullable<StaffTicketListParams["sortDirection"]>;

const isQueueSortField = (value: string): value is QueueSortField =>
  queueSortFields.some((field) => field === value);

const isQueueSortDirection = (value: string): value is QueueSortDirection =>
  value === "asc" || value === "desc";

const parseSort = (
  value: string
): { sortBy: QueueSortField; sortDirection: QueueSortDirection } => {
  const [sortBy, sortDirection] = value.split(":");

  if (
    sortBy !== undefined &&
    isQueueSortField(sortBy) &&
    sortDirection !== undefined &&
    isQueueSortDirection(sortDirection)
  ) {
    return { sortBy, sortDirection };
  }

  return { sortBy: "updatedAt", sortDirection: "desc" };
};

const parsePageSize = (value: string): 10 | 20 | 50 => {
  if (value === "10") {
    return 10;
  }

  if (value === "50") {
    return 50;
  }

  return 20;
};

const parseOwner = (value: string): StaffTicketOwnerFilter | undefined => {
  if (value === "me" || value === "unassigned") {
    return value;
  }

  if (/^[1-9]\d*$/u.test(value)) {
    const ownerId = Number(value);
    if (Number.isSafeInteger(ownerId)) {
      return ownerId;
    }
  }

  return undefined;
};

const hasTicketFilters = (params: StaffTicketListParams) =>
  (params.search !== undefined && params.search.length > 0) ||
  params.categoryId !== undefined ||
  params.relatedSystemId !== undefined ||
  params.requestedPriority !== undefined ||
  params.itPriority !== undefined ||
  params.currentStatus !== undefined ||
  params.owner !== undefined;

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

// oxlint-disable-next-line complexity -- this page renders documented queue filters and data states.
const StaffTicketQueueContent = ({ user }: { user: AuthUser }) => {
  const [params, setParams] = useState<StaffTicketListParams>(initialParams);
  const [searchDraft, setSearchDraft] = useState("");

  const categoriesQuery = useQuery(activeCategoriesQueryOptions());
  const relatedSystemsQuery = useQuery(relatedSystemsQueryOptions());
  const ownersQuery = useQuery(staffOwnersQueryOptions());
  const ticketsQuery = useQuery(staffTicketsQueryOptions(params));

  const updateParams = (change: Partial<StaffTicketListParams>) => {
    setParams((current) => ({ ...current, ...change, page: 1 }));
  };

  const clearFilters = () => {
    setSearchDraft("");
    setParams({ ...initialParams });
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
    categoriesQuery.isError ||
    relatedSystemsQuery.isError ||
    ownersQuery.isError;

  const retryFilterData = () => {
    void categoriesQuery.refetch();
    void relatedSystemsQuery.refetch();
    void ownersQuery.refetch();
  };

  const workspaceLabel =
    user.role === "Administrator"
      ? "Administrator workspace"
      : "IT Staff workspace";

  return (
    <AppShell
      eyebrow={workspaceLabel}
      title="Ticket Queue"
      allowedRoles={["IT Staff", "Administrator"]}
    >
      <div className="page-actions">
        <p className="page-description">
          Browse every support request and inspect its current operational
          ownership.
        </p>
        {showNoResults ? null : (
          <button
            className="button button-tertiary"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
            type="button"
          >
            <Icon icon={RefreshIcon} /> Clear Filters
          </button>
        )}
      </div>

      <section
        className="surface-card filter-card"
        aria-label="Ticket Queue filters"
      >
        <form className="filter-grid" onSubmit={submitSearch}>
          <div className="search-field">
            <label htmlFor="staff-ticket-search">Search</label>
            <div className="input-with-icon">
              <span aria-hidden="true">
                <Icon icon={Search01Icon} />
              </span>
              <input
                id="staff-ticket-search"
                maxLength={200}
                onChange={(event) => {
                  setSearchDraft(event.target.value);
                }}
                placeholder="Search Ticket Number or summary"
                type="search"
                value={searchDraft}
              />
            </div>
          </div>
          <div className="filter-field">
            <label htmlFor="staff-ticket-category-filter">Category</label>
            <select
              disabled={categoriesQuery.isPending || categoriesQuery.isError}
              id="staff-ticket-category-filter"
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
            <label htmlFor="staff-ticket-system-filter">Related System</label>
            <select
              disabled={
                relatedSystemsQuery.isPending || relatedSystemsQuery.isError
              }
              id="staff-ticket-system-filter"
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
            <label htmlFor="staff-ticket-requested-priority-filter">
              Requested Priority
            </label>
            <select
              id="staff-ticket-requested-priority-filter"
              onChange={(event) => {
                updateParams({
                  requestedPriority: isRequestedPriority(event.target.value)
                    ? event.target.value
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
            <label htmlFor="staff-ticket-it-priority-filter">IT Priority</label>
            <select
              id="staff-ticket-it-priority-filter"
              onChange={(event) => {
                updateParams({
                  itPriority: isRequestedPriority(event.target.value)
                    ? event.target.value
                    : undefined,
                });
              }}
              value={params.itPriority ?? ""}
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="staff-ticket-status-filter">Current Status</label>
            <select
              id="staff-ticket-status-filter"
              onChange={(event) => {
                updateParams({
                  currentStatus: isCurrentStatus(event.target.value)
                    ? event.target.value
                    : undefined,
                });
              }}
              value={params.currentStatus ?? ""}
            >
              <option value="">All Statuses</option>
              {currentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="staff-ticket-owner-filter">Ticket Owner</label>
            <select
              disabled={ownersQuery.isPending || ownersQuery.isError}
              id="staff-ticket-owner-filter"
              onChange={(event) => {
                updateParams({ owner: parseOwner(event.target.value) });
              }}
              value={params.owner?.toString() ?? ""}
            >
              <option value="">All Owners</option>
              <option value="me">Me</option>
              <option value="unassigned">Unassigned</option>
              {ownersQuery.data?.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="staff-ticket-sort">Sort</label>
            <select
              id="staff-ticket-sort"
              onChange={(event) => {
                updateParams(parseSort(event.target.value));
              }}
              value={`${params.sortBy ?? "updatedAt"}:${params.sortDirection ?? "desc"}`}
            >
              <option value="updatedAt:desc">Last Updated (newest)</option>
              <option value="updatedAt:asc">Last Updated (oldest)</option>
              <option value="ticketDate:desc">Ticket Date (newest)</option>
              <option value="ticketDate:asc">Ticket Date (oldest)</option>
              <option value="itPriority:asc">IT Priority (Low–Urgent)</option>
              <option value="itPriority:desc">IT Priority (Urgent–Low)</option>
              <option value="ticketNumber:asc">Ticket Number (A–Z)</option>
              <option value="ticketNumber:desc">Ticket Number (Z–A)</option>
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="staff-ticket-page-size">Per page</label>
            <select
              id="staff-ticket-page-size"
              onChange={(event) => {
                updateParams({ pageSize: parsePageSize(event.target.value) });
              }}
              value={params.pageSize ?? 20}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
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
              Retry to load the latest Category, Related System, and Owner
              options.
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
        aria-busy={ticketsQuery.isFetching}
        aria-labelledby="ticket-queue-heading"
        className="surface-card ticket-list-card"
      >
        <div className="section-heading list-heading">
          <div>
            <p className="eyebrow">Shared operational view</p>
            <h2 id="ticket-queue-heading">All Tickets</h2>
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
            <p className="loading-line">Loading the Ticket Queue…</p>
          ) : null}
          {ticketsQuery.isFetching && !ticketsQuery.isPending ? (
            <p className="loading-line">Updating queue results…</p>
          ) : null}
          {data && !ticketsQuery.isFetching ? (
            <p className="visually-hidden">{data.totalItems} Tickets loaded.</p>
          ) : null}
        </div>

        {ticketsQuery.isError ? (
          <div className="feedback feedback-error" role="alert">
            <strong>Could not load the Ticket Queue.</strong>
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
              <Icon icon={Ticket01Icon} />
            </div>
            <h3>No Tickets in the queue</h3>
            <p>New support requests will appear here.</p>
          </div>
        ) : null}

        {showNoResults ? (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-icon">
              <Icon icon={Search01Icon} />
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
              <Icon icon={Ticket01Icon} />
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
              <Icon icon={ArrowLeft01Icon} /> Previous page
            </button>
          </div>
        ) : null}

        {showLoadedTickets ? (
          <>
            <div className="ticket-table-wrap">
              <table className="ticket-table queue-table">
                <caption className="visually-hidden">
                  Shared TokTickIT Ticket Queue
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Ticket Number</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Current Status</th>
                    <th scope="col">IT Priority</th>
                    <th scope="col">Ticket Owner</th>
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
                      <td className="summary-cell">{ticket.summary}</td>
                      <td>
                        <StatusBadge
                          kind="status"
                          value={ticket.currentStatus}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          kind="priority"
                          value={ticket.itPriority}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          kind="owner"
                          value={ticket.owner?.displayName ?? "Unassigned"}
                        />
                      </td>
                      <td>{formatDate(ticket.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ticket-cards queue-cards">
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
                      <dt>IT Priority</dt>
                      <dd>
                        <StatusBadge
                          kind="priority"
                          value={ticket.itPriority}
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>Ticket Owner</dt>
                      <dd>
                        <StatusBadge
                          kind="owner"
                          value={ticket.owner?.displayName ?? "Unassigned"}
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
            <nav className="pagination" aria-label="Ticket Queue pages">
              <button
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => {
                  setParams((current) => ({ ...current, page: page - 1 }));
                }}
                type="button"
              >
                <Icon icon={ArrowLeft01Icon} /> Previous
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
                Next <Icon icon={ArrowRight01Icon} />
              </button>
            </nav>
          </>
        ) : null}
      </section>
    </AppShell>
  );
};

export const StaffTicketQueuePage = () => {
  const { user } = useAuth();

  if (user === null) {
    return <AuthRequired />;
  }

  if (user.mustChangePassword) {
    return <AuthRequired />;
  }

  if (user.role !== "IT Staff" && user.role !== "Administrator") {
    return <AccessDenied />;
  }

  return <StaffTicketQueueContent key={user.id} user={user} />;
};
