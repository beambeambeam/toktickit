import type { RefObject, SubmitEvent } from "react";

import { FormField, fieldDescribedBy } from "@/components/form-field";
import type { Owner } from "@/generated/hey-api/types.gen";
import type { ActionFieldErrors, ActionFormValues } from "@/lib/action-rules";

const AssigneeOptions = ({
  currentAssignee,
  draftAssignee,
  eligibleOwners,
  selectedId,
}: {
  currentAssignee: Owner | undefined;
  draftAssignee: Owner | undefined;
  eligibleOwners: readonly Owner[];
  selectedId: string;
}) => (
  <>
    {draftAssignee !== undefined &&
    String(draftAssignee.id) === selectedId &&
    draftAssignee.id !== currentAssignee?.id &&
    !eligibleOwners.some((owner) => owner.id === draftAssignee.id) ? (
      <option disabled value={draftAssignee.id}>
        {draftAssignee.displayName} · {draftAssignee.role} · draft{" "}
        {draftAssignee.isEligible ? "unavailable" : "ineligible"} assignee
      </option>
    ) : null}
    {currentAssignee !== undefined &&
    !eligibleOwners.some((owner) => owner.id === currentAssignee.id) ? (
      <option value={currentAssignee.id}>
        {currentAssignee.displayName} · {currentAssignee.role} · current{" "}
        {currentAssignee.isEligible ? "assignee" : "ineligible assignee"}
      </option>
    ) : null}
    {eligibleOwners.map((owner) => (
      <option key={owner.id} value={owner.id}>
        {owner.displayName} · {owner.role}
      </option>
    ))}
  </>
);

export const ActionForm = ({
  error,
  fieldErrors,
  formRef,
  form,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
  onRetryOriginal,
  onRetryAssignees,
  owners,
  ownersError,
  ownersLoading,
  uncertain = false,
  currentAssignee,
  draftAssignee,
  idPrefix = "action",
  saveDisabled = false,
}: {
  error: string | null;
  fieldErrors: ActionFieldErrors;
  formRef: RefObject<HTMLFormElement | null>;
  form: ActionFormValues;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: <K extends keyof ActionFormValues>(
    field: K,
    value: ActionFormValues[K]
  ) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onRetryOriginal?: () => void;
  onRetryAssignees: (() => Promise<unknown>) | undefined;
  owners: readonly Owner[];
  ownersError: Error | null;
  ownersLoading: boolean;
  uncertain?: boolean;
  currentAssignee?: Owner;
  draftAssignee?: Owner;
  idPrefix?: string;
  saveDisabled?: boolean;
}) => {
  const eligibleOwners = owners.filter(
    (owner) => owner.isActive && owner.isEligible
  );
  const descriptionError = fieldErrors.description;
  const resultError = fieldErrors.result;
  const followUpNoteError = fieldErrors.followUpNote;
  const attachmentNotesError = fieldErrors.attachmentNotes;

  return (
    <form className="action-create-form" onSubmit={onSubmit} ref={formRef}>
      <div className="form-grid form-grid-two">
        <FormField
          error={descriptionError}
          htmlFor={`${idPrefix}-description`}
          label="Action Description"
          required
        >
          <textarea
            aria-describedby={fieldDescribedBy(
              `${idPrefix}-description`,
              descriptionError !== undefined
            )}
            aria-invalid={descriptionError !== undefined}
            disabled={isSubmitting}
            id={`${idPrefix}-description`}
            name="description"
            onChange={(event) => {
              onChange("description", event.target.value);
            }}
            rows={5}
            value={form.description}
          />
        </FormField>
        <FormField
          error={resultError}
          htmlFor={`${idPrefix}-result`}
          label="Result"
        >
          <textarea
            aria-describedby={fieldDescribedBy(
              `${idPrefix}-result`,
              resultError !== undefined
            )}
            aria-invalid={resultError !== undefined}
            disabled={isSubmitting}
            id={`${idPrefix}-result`}
            name="result"
            onChange={(event) => {
              onChange("result", event.target.value);
            }}
            rows={5}
            value={form.result}
          />
        </FormField>
        <FormField
          error={fieldErrors.assigneeId}
          htmlFor={`${idPrefix}-assignee`}
          label="Assignee"
          required
        >
          <select
            aria-describedby={fieldDescribedBy(
              `${idPrefix}-assignee`,
              fieldErrors.assigneeId !== undefined
            )}
            aria-invalid={fieldErrors.assigneeId !== undefined}
            disabled={isSubmitting || ownersLoading || ownersError !== null}
            id={`${idPrefix}-assignee`}
            name="assigneeId"
            onChange={(event) => {
              onChange("assigneeId", event.target.value);
            }}
            value={form.assigneeId}
          >
            <option value="">Choose an eligible assignee</option>
            <AssigneeOptions
              currentAssignee={currentAssignee}
              draftAssignee={draftAssignee}
              eligibleOwners={eligibleOwners}
              selectedId={form.assigneeId}
            />
          </select>
        </FormField>
        <div className="form-field checkbox-field">
          <span className="field-label">Follow-up</span>
          <label htmlFor={`${idPrefix}-follow-up-required`}>
            <input
              checked={form.followUpRequired}
              disabled={isSubmitting}
              id={`${idPrefix}-follow-up-required`}
              name="followUpRequired"
              onChange={(event) => {
                onChange("followUpRequired", event.target.checked);
                if (!event.target.checked) {
                  onChange("followUpNote", "");
                }
              }}
              type="checkbox"
            />
            Follow-Up Required
          </label>
        </div>
      </div>

      {form.followUpRequired ? (
        <FormField
          error={followUpNoteError}
          htmlFor={`${idPrefix}-follow-up-note`}
          label="Follow-up Note"
          required
        >
          <textarea
            aria-describedby={fieldDescribedBy(
              `${idPrefix}-follow-up-note`,
              followUpNoteError !== undefined
            )}
            aria-invalid={followUpNoteError !== undefined}
            disabled={isSubmitting}
            id={`${idPrefix}-follow-up-note`}
            name="followUpNote"
            onChange={(event) => {
              onChange("followUpNote", event.target.value);
            }}
            rows={4}
            value={form.followUpNote}
          />
        </FormField>
      ) : null}

      <FormField
        error={attachmentNotesError}
        htmlFor={`${idPrefix}-attachment-notes`}
        label="Attachment Notes"
      >
        <textarea
          aria-describedby={fieldDescribedBy(
            `${idPrefix}-attachment-notes`,
            attachmentNotesError !== undefined
          )}
          aria-invalid={attachmentNotesError !== undefined}
          disabled={isSubmitting}
          id={`${idPrefix}-attachment-notes`}
          name="attachmentNotes"
          onChange={(event) => {
            onChange("attachmentNotes", event.target.value);
          }}
          rows={4}
          value={form.attachmentNotes}
        />
      </FormField>

      {ownersLoading ? (
        <p aria-live="polite" className="loading-line" role="status">
          Loading eligible assignees…
        </p>
      ) : null}
      {!ownersLoading && ownersError === null && eligibleOwners.length === 0 ? (
        <p className="empty-inline">
          No eligible assignees are available. Contact an Administrator to
          restore staff access.
        </p>
      ) : null}
      {ownersError === null ? null : (
        <div className="feedback feedback-warning" role="alert">
          <strong>Assignees unavailable.</strong>
          <span>Retry before saving an Action Taken.</span>
          {onRetryAssignees === undefined ? null : (
            <button
              className="button button-secondary"
              disabled={isSubmitting || ownersLoading}
              onClick={() => void onRetryAssignees()}
              type="button"
            >
              Retry assignees
            </button>
          )}
        </div>
      )}
      {uncertain ? (
        <div className="feedback feedback-warning" role="alert">
          <strong>The request may have succeeded.</strong>
          <span>
            Restore the original normalized draft before retrying with the same
            request ID.
          </span>
          <button
            className="button button-secondary"
            disabled={isSubmitting}
            onClick={onRetryOriginal}
            type="button"
          >
            Retry original action
          </button>
        </div>
      ) : null}
      {error === null ? null : (
        <div className="feedback feedback-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="form-actions">
        <button
          className="button button-secondary"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="button button-primary"
          disabled={
            isSubmitting ||
            ownersLoading ||
            ownersError !== null ||
            saveDisabled
          }
          type="submit"
        >
          {isSubmitting ? "Saving…" : "Save Action Taken"}
        </button>
      </div>
    </form>
  );
};
