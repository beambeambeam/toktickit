import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { ticketActionsQueryOptions } from "@/api/action-query-options";
import {
  ActionCreateForm,
  useActionsTakenCreate,
} from "@/components/actions-taken-create";
import { ActionsTakenList } from "@/components/actions-taken-list";
import type { Owner, UserRole } from "@/generated/hey-api/types.gen";
import type { CurrentStatus } from "@/lib/ticket-statuses";

const PAGE_SIZE = 20 as const;

export interface ActionsTakenSectionProps {
  currentStatus: CurrentStatus;
  defaultAssigneeId: number;
  onRefreshTicket: () => Promise<unknown>;
  onRetryAssignees?: () => Promise<unknown>;
  owners: readonly Owner[];
  ownersError?: Error | null;
  ownersLoading?: boolean;
  principalId: number;
  principalRole: UserRole;
  ticketId: number;
  ticketVersion: number;
}

export const ActionsTakenSection = ({
  currentStatus,
  defaultAssigneeId,
  onRefreshTicket,
  onRetryAssignees,
  owners,
  ownersError = null,
  ownersLoading = false,
  principalId,
  principalRole,
  ticketId,
  ticketVersion,
}: ActionsTakenSectionProps) => {
  const [page, setPage] = useState(1);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const wasCreateOpen = useRef(false);
  const createState = useActionsTakenCreate({
    currentStatus,
    defaultAssigneeId,
    principalId,
    principalRole,
    ticketId,
    ticketVersion,
  });
  const actionsQuery = useQuery({
    ...ticketActionsQueryOptions(ticketId, principalId, principalRole, {
      page,
      pageSize: PAGE_SIZE,
    }),
    enabled: ticketId > 0,
  });

  // oxlint-disable react/react-compiler -- reset the list page when the authenticated Ticket identity changes.
  useEffect(() => {
    setPage(1);
  }, [defaultAssigneeId, principalId, principalRole, ticketId]);
  // oxlint-enable react/react-compiler

  useEffect(() => {
    if (createState.isCreateOpen) {
      createState.formRef.current
        ?.querySelector<HTMLTextAreaElement>('[name="description"]')
        ?.focus();
    } else if (wasCreateOpen.current) {
      addButtonRef.current?.focus();
    }
    wasCreateOpen.current = createState.isCreateOpen;
  }, [createState.formRef, createState.isCreateOpen]);

  const actionPage = actionsQuery.data;

  return (
    <section
      aria-labelledby="actions-taken-heading"
      className="surface-card form-section actions-taken-section"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Shared work record</p>
          <h2 id="actions-taken-heading">Actions Taken</h2>
        </div>
        <div className="section-heading-actions">
          {actionPage === undefined ? null : (
            <span className="result-count">
              {actionPage.totalItems} action(s)
            </span>
          )}
          {createState.canCreate ? (
            <button
              ref={addButtonRef}
              className="button button-primary"
              disabled={createState.isSubmitting || createState.isCreateOpen}
              onClick={createState.handleOpenCreateForm}
              type="button"
            >
              Add Action Taken
            </button>
          ) : null}
        </div>
      </div>

      {createState.isCreateOpen ? (
        <div className="action-create-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">New Planned action</p>
              <h3>Add Action Taken</h3>
            </div>
            <span className="required-note">
              Ticket version {ticketVersion}
            </span>
          </div>
          <ActionCreateForm
            error={createState.createFailure?.message ?? null}
            fieldErrors={createState.fieldErrors}
            formRef={createState.formRef}
            form={createState.form}
            isSubmitting={createState.isSubmitting}
            onCancel={createState.handleCloseCreateForm}
            onChange={createState.handleSetField}
            onRetryOriginal={createState.handleRetryOriginalAction}
            onRetryAssignees={onRetryAssignees}
            onSubmit={(event) => void createState.handleCreateSubmit(event)}
            owners={owners}
            ownersError={ownersError}
            ownersLoading={ownersLoading}
            uncertain={createState.uncertain}
          />
        </div>
      ) : null}

      <div aria-live="polite" className="operation-status" role="status">
        {createState.createSuccess === null ? null : (
          <span className="success-message">
            {createState.createSuccess}
            {createState.savedAction === null
              ? null
              : ` Saved Planned action #${createState.savedAction.id}.`}
          </span>
        )}
      </div>

      <ActionsTakenList
        actionPage={actionPage}
        actionsError={actionsQuery.isError ? actionsQuery.error : null}
        actionsFetching={actionsQuery.isFetching}
        actionsPending={actionsQuery.isPending}
        onPageChange={setPage}
        onRetry={() => void actionsQuery.refetch()}
        page={page}
      />

      {createState.createFailure?.kind === "version-conflict" ? (
        <div className="feedback feedback-warning" role="alert">
          <span>Review the latest Ticket before retrying this draft.</span>
          <button
            className="button button-secondary"
            disabled={createState.isSubmitting}
            onClick={() => {
              void onRefreshTicket();
            }}
            type="button"
          >
            Refresh latest Ticket
          </button>
        </div>
      ) : null}
    </section>
  );
};
