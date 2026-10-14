import { Ticket01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type {
  StaffMyActionsPageSize,
  StaffMyActionsParams,
} from "@/api/staff-actions";
import { staffMyActionsQueryOptions } from "@/api/staff-actions-query-options";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { MyActionListItem } from "@/components/my-action-list-item";
import { PaginationNav } from "@/components/pagination-nav";
import { useAuth } from "@/context/auth";
import type { MyActionListResponse } from "@/generated/hey-api/types.gen";
import { buildLoadFailureCopy, loadFailureKind } from "@/lib/load-failure";
import { isStaffRole, STAFF_ROLES } from "@/lib/staff-roles";

const PAGE_SIZES: readonly StaffMyActionsPageSize[] = [10, 20, 50];

const parsePageSize = (value: string): StaffMyActionsPageSize =>
  PAGE_SIZES.find((pageSize) => String(pageSize) === value) ?? 20;

const FAILURE_COPY = buildLoadFailureCopy({
  forbiddenBody: "You do not have permission to view My Actions.",
  genericBody:
    "Could not load your actions. Check your connection and try again.",
  genericHeading: "My Actions could not be loaded",
  sessionBody: "Sign in again to view your actions.",
});

const MyActionsResults = ({ data }: { data: MyActionListResponse }) => {
  if (data.totalItems === 0) {
    return (
      <div className="empty-state">
        <div aria-hidden="true" className="empty-icon">
          <Icon icon={Ticket01Icon} />
        </div>
        <h2>No assigned actions</h2>
        <p>
          No Planned or In Progress actions are assigned to you on active
          Tickets.
        </p>
      </div>
    );
  }

  return data.items.length === 0 ? null : (
    <section
      aria-label="My Actions"
      className="surface-card dashboard-preview-card"
    >
      <ul className="dashboard-preview-list">
        {data.items.map((action) => (
          <MyActionListItem action={action} key={action.id} />
        ))}
      </ul>
    </section>
  );
};

export const StaffMyActionsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useState<StaffMyActionsParams>({
    page: 1,
    pageSize: 20,
  });
  const canViewActions = user !== null && isStaffRole(user.role);
  const actionsQuery = useQuery({
    ...staffMyActionsQueryOptions(
      user?.id ?? 0,
      user?.role ?? "IT Staff",
      params
    ),
    enabled: canViewActions,
  });
  // A failed refetch must not leave the previous page looking current.
  const data = actionsQuery.isError ? undefined : actionsQuery.data;
  const failure = actionsQuery.isError
    ? loadFailureKind(actionsQuery.error)
    : null;
  const lastPage = data?.totalPages ?? 0;

  // Actions finished elsewhere can shrink the list below the current page.
  if (lastPage > 0 && params.page > lastPage) {
    setParams({ ...params, page: lastPage });
  }

  return (
    <AppShell
      allowedRoles={STAFF_ROLES}
      eyebrow="Staff workspace"
      title="My Actions"
    >
      <p className="page-description">
        Planned and In Progress actions assigned to you on active Tickets.
      </p>
      <div className="filter-field">
        <label htmlFor="staff-my-actions-page-size">Per page</label>
        <select
          id="staff-my-actions-page-size"
          onChange={(event) => {
            setParams({
              page: 1,
              pageSize: parsePageSize(event.target.value),
            });
          }}
          value={params.pageSize}
        >
          {PAGE_SIZES.map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </div>
      {actionsQuery.isPending ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading your actions…
        </p>
      ) : null}
      {failure === null ? null : (
        <section className="surface-card feedback feedback-error" role="alert">
          <h2>{FAILURE_COPY[failure].heading}</h2>
          <p>{FAILURE_COPY[failure].body}</p>
          {failure === "generic" ? (
            <button
              aria-disabled={actionsQuery.isFetching}
              className="button button-secondary"
              onClick={() => {
                if (!actionsQuery.isFetching) {
                  void actionsQuery.refetch();
                }
              }}
              type="button"
            >
              Retry My Actions
            </button>
          ) : null}
        </section>
      )}
      {data === undefined ? null : <MyActionsResults data={data} />}
      {data === undefined || data.totalPages === 0 ? null : (
        <PaginationNav
          label="My Actions pages"
          onPageChange={(nextPage) => {
            setParams((current) => ({ ...current, page: nextPage }));
          }}
          page={data.page}
          totalPages={data.totalPages}
        />
      )}
    </AppShell>
  );
};
