import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { AuthRequired, AuthLoading, AppShell } from "@/components/app-shell";
import { FormField, fieldDescribedBy } from "@/components/form-field";
import { useAuth } from "@/context/auth";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordChange,
} from "@/lib/auth-rules";
import type { PasswordChangeFieldErrors } from "@/lib/auth-rules";

const getChangePasswordErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof ApiRequestError && error.status === 429) {
    return "Too many password-change attempts. Try again later.";
  }

  if (error instanceof ApiRequestError && error.message.length > 0) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to change your password. Try again.";
};

const getRetryAfterSeconds = (error: unknown): number | null => {
  if (!(error instanceof ApiRequestError) || error.status !== 429) {
    return null;
  }

  return error.retryAfterSeconds ?? 1;
};

const getPasswordFieldErrors = (error: unknown): PasswordChangeFieldErrors => {
  if (!(error instanceof ApiRequestError) || error.details === undefined) {
    return {};
  }

  const errors: PasswordChangeFieldErrors = {};
  const { fields } = error.details;

  if (typeof fields === "object" && fields !== null && !Array.isArray(fields)) {
    for (const [field, message] of Object.entries(fields)) {
      if (
        (field === "currentPassword" ||
          field === "newPassword" ||
          field === "confirmation") &&
        typeof message === "string"
      ) {
        errors[field] = message;
      }
    }
  }

  if (
    Object.keys(errors).length === 0 &&
    typeof error.details.field === "string" &&
    typeof error.details.reason === "string" &&
    (error.details.field === "currentPassword" ||
      error.details.field === "newPassword" ||
      error.details.field === "confirmation")
  ) {
    errors[error.details.field] = error.details.reason;
  }

  return errors;
};

const PasswordBrand = ({
  displayName,
  role,
  onLogout,
  isLoggingOut,
  logoutError,
}: {
  displayName: string;
  isLoggingOut: boolean;
  logoutError: string | null;
  onLogout: () => void;
  role: string;
}) => (
  <header className="auth-header">
    <div className="auth-header-inner">
      <span className="brand">
        <span aria-hidden="true" className="brand-mark">
          ◷
        </span>
        <span>TokTickIT</span>
      </span>
      <span className="restricted-account">
        {displayName} · {role}
      </span>
      {logoutError === null ? null : (
        <span className="logout-error" role="alert">
          {logoutError}
        </span>
      )}
      <button
        className="button button-ghost"
        disabled={isLoggingOut}
        onClick={onLogout}
        type="button"
      >
        {isLoggingOut ? "Signing out…" : "Log out"}
      </button>
    </div>
  </header>
);

const PasswordForm = ({
  mandatory,
  onCancel,
}: {
  mandatory: boolean;
  onCancel: () => void;
}) => {
  const navigate = useNavigate();
  const { changePassword, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordChangeFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const Heading = mandatory ? "h1" : "h2";

  useEffect(() => {
    let timer: number | undefined;

    if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
      timer = window.setInterval(() => {
        setRetryAfterSeconds((current) => {
          if (current === null || current <= 1) {
            return null;
          }

          return current - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [retryAfterSeconds]);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmation
    );
    setFieldErrors(errors);
    setSubmitError(null);
    setSuccessMessage(null);
    setRetryAfterSeconds(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccessMessage("Password changed. Your session was renewed.");
      await navigate({ to: user?.role === "Requester" ? "/tickets" : "/" });
    } catch (error: unknown) {
      setFieldErrors(getPasswordFieldErrors(error));
      setSubmitError(getChangePasswordErrorMessage(error));
      setRetryAfterSeconds(getRetryAfterSeconds(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="auth-card password-card"
      aria-labelledby="password-heading"
    >
      <div className="auth-card-header">
        <div aria-hidden="true" className="auth-icon">
          ◆
        </div>
        <Heading id="password-heading">
          {mandatory ? "Set your new password" : "Change password"}
        </Heading>
        <p>
          {mandatory
            ? "A new password is required before you can use TokTickIT."
            : "Choose a new password for your TokTickIT account."}
        </p>
      </div>
      <div className="auth-card-body">
        {submitError === null ? null : (
          <div className="feedback feedback-error" role="alert">
            <strong>Password change failed.</strong>
            <span>{submitError}</span>
            {retryAfterSeconds === null ? null : (
              <span>
                Try again in {retryAfterSeconds} second
                {retryAfterSeconds === 1 ? "" : "s"}.
              </span>
            )}
          </div>
        )}
        {successMessage === null ? null : (
          <div className="feedback feedback-success" role="status">
            {successMessage}
          </div>
        )}

        <form
          noValidate
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <FormField
            error={fieldErrors.currentPassword}
            htmlFor="current-password"
            label="Current password"
            required
          >
            <input
              aria-describedby={fieldDescribedBy(
                "current-password",
                Boolean(fieldErrors.currentPassword)
              )}
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              autoComplete="current-password"
              disabled={isSubmitting || retryAfterSeconds !== null}
              id="current-password"
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  currentPassword: undefined,
                }));
                setSubmitError(null);
              }}
              type="password"
              value={currentPassword}
            />
          </FormField>

          <FormField
            error={fieldErrors.newPassword}
            htmlFor="new-password"
            label="New password"
            required
          >
            <input
              aria-describedby={
                [
                  "new-password-help",
                  fieldDescribedBy(
                    "new-password",
                    Boolean(fieldErrors.newPassword)
                  ),
                ]
                  .filter((value): value is string => value !== undefined)
                  .join(" ") || undefined
              }
              aria-invalid={Boolean(fieldErrors.newPassword)}
              autoComplete="new-password"
              disabled={isSubmitting || retryAfterSeconds !== null}
              id="new-password"
              onChange={(event) => {
                setNewPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  newPassword: undefined,
                }));
                setSubmitError(null);
              }}
              type="password"
              value={newPassword}
            />
            <p className="field-help" id="new-password-help">
              Use {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} Unicode
              characters. Spaces and pasted text are allowed.
            </p>
          </FormField>

          <FormField
            error={fieldErrors.confirmation}
            htmlFor="confirm-password"
            label="Confirm new password"
            required
          >
            <input
              aria-describedby={fieldDescribedBy(
                "confirm-password",
                Boolean(fieldErrors.confirmation)
              )}
              aria-invalid={Boolean(fieldErrors.confirmation)}
              autoComplete="new-password"
              disabled={isSubmitting || retryAfterSeconds !== null}
              id="confirm-password"
              onChange={(event) => {
                setConfirmation(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  confirmation: undefined,
                }));
                setSubmitError(null);
              }}
              type="password"
              value={confirmation}
            />
          </FormField>

          <div aria-live="polite" className="form-status" role="status">
            {isSubmitting ? <span>Saving your password…</span> : null}
          </div>
          <div className="form-actions">
            {mandatory ? null : (
              <button
                className="button button-secondary"
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
              >
                Cancel
              </button>
            )}
            <button
              className="button button-primary"
              disabled={isSubmitting || retryAfterSeconds !== null}
              type="submit"
            >
              {isSubmitting ? "Saving…" : null}
              {!isSubmitting && mandatory ? "Save and continue" : null}
              {!isSubmitting && !mandatory ? "Save password" : null}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { isLoading, logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  if (isLoading) {
    return <AuthLoading />;
  }

  if (user === null) {
    return <AuthRequired />;
  }

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      await navigate({ to: "/login" });
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to sign out."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const form = (
    <PasswordForm
      mandatory={user.mustChangePassword}
      onCancel={() => void navigate({ to: "/tickets" })}
    />
  );

  if (user.mustChangePassword) {
    return (
      <div className="auth-page">
        <PasswordBrand
          displayName={user.displayName}
          isLoggingOut={isLoggingOut}
          logoutError={logoutError}
          onLogout={() => void handleLogout()}
          role={user.role}
        />
        <main className="auth-main mandatory-password-main">{form}</main>
      </div>
    );
  }

  return (
    <AppShell eyebrow="Account" title="Change Password">
      {form}
    </AppShell>
  );
};
