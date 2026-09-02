import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { SubmitEvent } from "react";

import {
  categoriesQueryOptionsV2,
  relatedSystemsQueryOptions,
} from "@/api/lab2-options";
import { createTicket } from "@/api/requester";
import { AppShell, RequesterRequired } from "@/components/app-shell";
import { AttachmentPicker } from "@/components/attachment-picker";
import {
  FormField,
  fieldDescribedBy,
  ReadOnlyField,
} from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { useRequester } from "@/context/requester";
import {
  getApiFieldErrors,
  isRequestedPriority,
  validateSelectedFiles,
  validateTicketForm,
} from "@/lib/ticket-rules";
import type { TicketFieldErrors, TicketFormValues } from "@/lib/ticket-rules";

const initialValues: TicketFormValues = {
  categoryId: "",
  description: "",
  relatedSystemId: "",
  requestedPriority: "",
  summary: "",
};

const apiErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const CreateTicketPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { requester } = useRequester();
  const categoriesQuery = useQuery(categoriesQueryOptionsV2());
  const relatedSystemsQuery = useQuery(relatedSystemsQueryOptions());
  const [values, setValues] = useState<TicketFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<TicketFieldErrors>({});
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Awaited<
    ReturnType<typeof createTicket>
  > | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (requester === null) {
        throw new Error(
          "Select a Development Requester before creating a Ticket."
        );
      }

      const priority = values.requestedPriority;
      if (!isRequestedPriority(priority)) {
        throw new Error("Choose a valid Requested Priority.");
      }

      return await createTicket({
        attachments: files,
        categoryId: Number(values.categoryId),
        description: values.description.trim(),
        relatedSystemId: Number(values.relatedSystemId),
        requestedPriority: priority,
        requesterId: requester.id,
        summary: values.summary.trim(),
      });
    },
    onError: (error: unknown) => {
      setFieldErrors(getApiFieldErrors(error));
      setSubmitError(
        apiErrorMessage(
          error,
          "Unable to create the Ticket. Your entered values are preserved."
        )
      );
    },
    onSuccess: (ticket) => {
      setSubmitError(null);
      setCreatedTicket(ticket);
      void queryClient.invalidateQueries({
        queryKey: ["tickets", requester?.id],
      });
    },
  });

  if (requester === null) {
    return <RequesterRequired />;
  }

  const updateValue = (field: keyof TicketFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const handleFiles = (selectedFiles: File[]) => {
    const result = validateSelectedFiles(selectedFiles);
    setFiles(result.validFiles);
    setAttachmentErrors(result.errors);
    setSubmitError(null);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateTicketForm(values);
    setFieldErrors(errors);
    setSubmitError(null);

    if (Object.keys(errors).length > 0 || attachmentErrors.length > 0) {
      setSubmitError("Review the highlighted fields before submitting.");
      return;
    }

    createMutation.mutate();
  };

  const referencesLoading =
    categoriesQuery.isPending || relatedSystemsQuery.isPending;
  const referencesFailed =
    categoriesQuery.isError || relatedSystemsQuery.isError;

  return (
    <AppShell eyebrow="Requester workspace" title="Create Ticket">
      <div className="page-actions">
        <span className="context-note">
          Creating as <strong>{requester.displayName}</strong>
        </span>
        <button
          className="button button-secondary"
          onClick={() => void navigate({ to: "/tickets" })}
          type="button"
        >
          Back to My Tickets
        </button>
      </div>

      {createdTicket === null ? (
        <form className="ticket-form" noValidate onSubmit={submit}>
          <section
            className="surface-card form-section"
            aria-labelledby="ticket-context-heading"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">New request</p>
                <h2 id="ticket-context-heading">Ticket information</h2>
              </div>
              <span className="required-note">
                <span aria-hidden="true" className="required-mark">
                  *
                </span>{" "}
                Required
              </span>
            </div>
            <div className="readonly-grid">
              <ReadOnlyField
                label="Requester"
                value={`${requester.displayName} · ${requester.email}`}
              />
              <ReadOnlyField
                label="Ticket Number"
                value="Generated after submission"
              />
              <ReadOnlyField
                label="Ticket Date"
                value="Generated by TokTickIT"
              />
              <ReadOnlyField
                label="Current Status"
                value="New after submission"
              />
            </div>
          </section>

          <section
            className="surface-card form-section"
            aria-labelledby="ticket-details-heading"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Describe the issue</p>
                <h2 id="ticket-details-heading">Request details</h2>
              </div>
            </div>

            {referencesFailed ? (
              <div className="feedback feedback-error" role="alert">
                <strong>Reference data unavailable.</strong>
                <span>
                  {apiErrorMessage(
                    categoriesQuery.error ?? relatedSystemsQuery.error,
                    "Retry to load Categories and Related Systems."
                  )}
                </span>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    void categoriesQuery.refetch();
                    void relatedSystemsQuery.refetch();
                  }}
                  type="button"
                >
                  Retry reference data
                </button>
              </div>
            ) : null}

            {referencesLoading ? (
              <p aria-live="polite" className="loading-line" role="status">
                Loading Categories and Related Systems…
              </p>
            ) : null}

            <div className="form-grid form-grid-two">
              <FormField
                error={fieldErrors.categoryId}
                htmlFor="categoryId"
                label="Category"
                required
              >
                <select
                  aria-describedby={fieldDescribedBy(
                    "categoryId",
                    Boolean(fieldErrors.categoryId)
                  )}
                  aria-invalid={Boolean(fieldErrors.categoryId)}
                  disabled={referencesLoading || categoriesQuery.isError}
                  id="categoryId"
                  onChange={(event) => {
                    updateValue("categoryId", event.target.value);
                  }}
                  value={values.categoryId}
                >
                  <option value="">Choose a Category</option>
                  {categoriesQuery.data?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                error={fieldErrors.relatedSystemId}
                htmlFor="relatedSystemId"
                label="Related System"
                required
              >
                <select
                  aria-describedby={fieldDescribedBy(
                    "relatedSystemId",
                    Boolean(fieldErrors.relatedSystemId)
                  )}
                  aria-invalid={Boolean(fieldErrors.relatedSystemId)}
                  disabled={referencesLoading || relatedSystemsQuery.isError}
                  id="relatedSystemId"
                  onChange={(event) => {
                    updateValue("relatedSystemId", event.target.value);
                  }}
                  value={values.relatedSystemId}
                >
                  <option value="">Choose a Related System</option>
                  {relatedSystemsQuery.data?.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                error={fieldErrors.summary}
                htmlFor="summary"
                label="Ticket Summary"
                required
              >
                <input
                  aria-describedby={fieldDescribedBy(
                    "summary",
                    Boolean(fieldErrors.summary)
                  )}
                  aria-invalid={Boolean(fieldErrors.summary)}
                  id="summary"
                  maxLength={120}
                  onChange={(event) => {
                    updateValue("summary", event.target.value);
                  }}
                  placeholder="Briefly describe the problem"
                  value={values.summary}
                />
              </FormField>

              <FormField
                error={fieldErrors.requestedPriority}
                htmlFor="requestedPriority"
                label="Requested Priority"
                required
              >
                <select
                  aria-describedby={fieldDescribedBy(
                    "requestedPriority",
                    Boolean(fieldErrors.requestedPriority)
                  )}
                  aria-invalid={Boolean(fieldErrors.requestedPriority)}
                  id="requestedPriority"
                  onChange={(event) => {
                    updateValue("requestedPriority", event.target.value);
                  }}
                  value={values.requestedPriority}
                >
                  <option value="">Choose a priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </FormField>
            </div>

            <FormField
              error={fieldErrors.description}
              htmlFor="description"
              label="Description"
              required
            >
              <textarea
                aria-describedby={fieldDescribedBy(
                  "description",
                  Boolean(fieldErrors.description)
                )}
                aria-invalid={Boolean(fieldErrors.description)}
                id="description"
                maxLength={4000}
                onChange={(event) => {
                  updateValue("description", event.target.value);
                }}
                placeholder="Include what happened, when it started, and any useful steps to reproduce it."
                rows={7}
                value={values.description}
              />
            </FormField>

            <AttachmentPicker
              disabled={createMutation.isPending}
              errors={attachmentErrors}
              files={files}
              onChange={handleFiles}
            />

            {submitError !== null && submitError.length > 0 ? (
              <div className="feedback feedback-error" role="alert">
                {submitError}
              </div>
            ) : null}

            <div aria-live="polite" className="form-status" role="status">
              {createMutation.isPending ? (
                <span>Creating your Ticket…</span>
              ) : null}
            </div>

            <div className="form-actions">
              <button
                className="button button-secondary"
                onClick={() => void navigate({ to: "/tickets" })}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={
                  createMutation.isPending ||
                  referencesLoading ||
                  referencesFailed
                }
                type="submit"
              >
                {createMutation.isPending
                  ? "Creating Ticket…"
                  : "Create Ticket"}
              </button>
            </div>
          </section>
        </form>
      ) : (
        <section
          className="surface-card success-card"
          aria-labelledby="ticket-created-heading"
        >
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="eyebrow">Saved successfully</p>
          <h2 id="ticket-created-heading">Ticket created</h2>
          <p>Your support request is now in My Tickets.</p>
          <div className="created-ticket-number">
            <span>Ticket Number</span>
            <strong>{createdTicket.ticketNumber}</strong>
          </div>
          <div className="success-summary">
            <span>{createdTicket.summary}</span>
            <StatusBadge
              kind="priority"
              value={createdTicket.requestedPriority}
            />
            <StatusBadge kind="status" value={createdTicket.currentStatus} />
          </div>
          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={() => void navigate({ to: "/tickets" })}
              type="button"
            >
              Go to My Tickets
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                setCreatedTicket(null);
                setValues(initialValues);
                setFiles([]);
                setAttachmentErrors([]);
              }}
              type="button"
            >
              Create another Ticket
            </button>
          </div>
        </section>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/create")({
  component: CreateTicketPage,
});
