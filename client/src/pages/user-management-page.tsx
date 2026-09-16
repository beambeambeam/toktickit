import {
  Search01Icon,
  UserGroupIcon,
  UserShield01Icon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { userQueryOptions, usersQueryOptions } from "@/api/query-options";
import { createUser, resetUserInitialPassword, updateUser } from "@/api/users";
import type { User, UserListParams, UserRole } from "@/api/users";
import {
  AccessDenied,
  AppShell,
  AuthLoading,
  AuthRequired,
} from "@/components/app-shell";
import { fieldDescribedBy, FormField } from "@/components/form-field";
import { Icon } from "@/components/icon";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/context/auth";
import {
  getUserFieldErrors,
  MAX_USER_SEARCH_LENGTH,
  validateUserEditForm,
  validateUserForm,
} from "@/lib/user-rules";
import type {
  UserEditFormValues,
  UserFieldErrors,
  UserFormValues,
} from "@/lib/user-rules";

const userRoles: readonly UserRole[] = [
  "Requester",
  "IT Staff",
  "Administrator",
];

const initialFormValues: UserFormValues = {
  displayName: "",
  email: "",
  initialPassword: "",
  isActive: true,
  role: "",
};

const initialEditFormValues: UserEditFormValues = {
  displayName: "",
  email: "",
  isActive: true,
  role: "",
};

const toEditFormValues = (user: User): UserEditFormValues => ({
  displayName: user.displayName,
  email: user.email,
  isActive: user.isActive,
  role: user.role,
});

const userFieldIds: readonly (readonly [keyof UserFormValues, string])[] = [
  ["displayName", "user-display-name"],
  ["email", "user-email"],
  ["role", "user-role"],
  ["initialPassword", "user-initial-password"],
];

const focusFirstUserFieldError = (errors: UserFieldErrors): void => {
  for (const [field, id] of userFieldIds) {
    if (errors[field] !== undefined) {
      document.querySelector<HTMLElement>(`#${id}`)?.focus();
      return;
    }
  }
};

const isUserRole = (value: string): value is UserRole =>
  userRoles.some((role) => role === value);

const getUserErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof ApiRequestError && error.code === "EMAIL_CONFLICT") {
    return "That email address is already in use. Enter a unique email address.";
  }

  if (error instanceof ApiRequestError && error.code === "SELF_DEACTIVATION") {
    return "You cannot deactivate your own Administrator account.";
  }

  if (
    error instanceof ApiRequestError &&
    error.code === "LAST_ADMIN_REQUIRED"
  ) {
    return "At least one active Administrator account must remain.";
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to save the account. Entered values are preserved.";
};

const getUserListErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to load user accounts. Try again.";
};

const RoleBadge = ({ role }: { role: UserRole }) => (
  <span className="role-badge">
    <span aria-hidden="true">
      <Icon icon={UserShield01Icon} />
    </span>{" "}
    {role}
  </span>
);

const AccountStatusBadge = ({ isActive }: { isActive: boolean }) => (
  <StatusBadge kind="status" value={isActive ? "Active" : "Inactive"} />
);

const UserTable = ({
  onEdit,
  users,
}: {
  onEdit: (user: User) => void;
  users: readonly User[];
}) => (
  <div className="user-table-wrap">
    <table className="user-table">
      <caption className="visually-hidden">TokTickIT user accounts</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Email</th>
          <th scope="col">Role</th>
          <th scope="col">Status</th>
          <th scope="col">Edit</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <th scope="row">{user.displayName}</th>
            <td>{user.email}</td>
            <td>
              <RoleBadge role={user.role} />
            </td>
            <td>
              <AccountStatusBadge isActive={user.isActive} />
            </td>
            <td>
              <button
                aria-label={`Edit ${user.displayName}`}
                className="button button-secondary button-small"
                onClick={() => {
                  onEdit(user);
                }}
                type="button"
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const UserCards = ({
  onEdit,
  users,
}: {
  onEdit: (user: User) => void;
  users: readonly User[];
}) => (
  <div className="user-cards">
    {users.map((user) => (
      <article className="user-card" key={user.id}>
        <div className="user-card-heading">
          <h3>{user.displayName}</h3>
          <AccountStatusBadge isActive={user.isActive} />
        </div>
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              <RoleBadge role={user.role} />
            </dd>
          </div>
        </dl>
        <button
          aria-label={`Edit ${user.displayName}`}
          className="button button-secondary"
          onClick={() => {
            onEdit(user);
          }}
          type="button"
        >
          Edit
        </button>
      </article>
    ))}
  </div>
);

const UserCreateForm = ({
  fieldErrors,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
  submitError,
  successMessage,
  values,
}: {
  fieldErrors: UserFieldErrors;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: <Field extends keyof UserFormValues>(
    field: Field,
    value: UserFormValues[Field]
  ) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  submitError: string | null;
  successMessage: string | null;
  values: UserFormValues;
}) => (
  <section
    aria-labelledby="create-user-heading"
    className="surface-card form-section user-create-card"
  >
    <div className="section-heading">
      <div>
        <p className="eyebrow">Administrator action</p>
        <h2 id="create-user-heading">Create User</h2>
      </div>
      <span className="required-note">* Required</span>
    </div>

    {submitError === null ? null : (
      <div className="feedback feedback-error" role="alert">
        <strong>Account creation failed.</strong>
        <span>{submitError}</span>
      </div>
    )}
    {successMessage === null ? null : (
      <div className="feedback feedback-success" role="status">
        {successMessage}
      </div>
    )}

    <form noValidate onSubmit={onSubmit}>
      <div className="form-grid form-grid-two">
        <FormField
          error={fieldErrors.displayName}
          htmlFor="user-display-name"
          label="Name"
          required
        >
          <input
            aria-describedby={fieldDescribedBy(
              "user-display-name",
              Boolean(fieldErrors.displayName)
            )}
            aria-invalid={Boolean(fieldErrors.displayName)}
            autoComplete="name"
            disabled={isSubmitting}
            id="user-display-name"
            onChange={(event) => {
              onChange("displayName", event.target.value);
            }}
            value={values.displayName}
          />
        </FormField>

        <FormField
          error={fieldErrors.email}
          htmlFor="user-email"
          label="Email"
          required
        >
          <input
            aria-describedby={fieldDescribedBy(
              "user-email",
              Boolean(fieldErrors.email)
            )}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="email"
            disabled={isSubmitting}
            id="user-email"
            inputMode="email"
            onChange={(event) => {
              onChange("email", event.target.value);
            }}
            type="email"
            value={values.email}
          />
        </FormField>

        <FormField
          error={fieldErrors.role}
          htmlFor="user-role"
          label="Role"
          required
        >
          <select
            aria-describedby={fieldDescribedBy(
              "user-role",
              Boolean(fieldErrors.role)
            )}
            aria-invalid={Boolean(fieldErrors.role)}
            disabled={isSubmitting}
            id="user-role"
            onChange={(event) => {
              const role = event.target.value;
              onChange("role", isUserRole(role) ? role : "");
            }}
            value={values.role}
          >
            <option value="">Choose a role</option>
            {userRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </FormField>

        <div className="form-field checkbox-field">
          <span className="field-label">Status</span>
          <label>
            <input
              checked={values.isActive}
              disabled={isSubmitting}
              onChange={(event) => {
                onChange("isActive", event.target.checked);
              }}
              type="checkbox"
            />
            <span>Active account</span>
          </label>
          <p className="field-help">
            Inactive accounts cannot sign in until an Administrator activates
            them.
          </p>
        </div>

        <div className="wide-field">
          <FormField
            error={fieldErrors.initialPassword}
            htmlFor="user-initial-password"
            label="Initial password"
            required
          >
            <input
              aria-describedby={
                [
                  "user-password-help",
                  fieldDescribedBy(
                    "user-initial-password",
                    Boolean(fieldErrors.initialPassword)
                  ),
                ]
                  .filter((value): value is string => value !== undefined)
                  .join(" ") || undefined
              }
              aria-invalid={Boolean(fieldErrors.initialPassword)}
              autoComplete="new-password"
              disabled={isSubmitting}
              id="user-initial-password"
              onChange={(event) => {
                onChange("initialPassword", event.target.value);
              }}
              type="password"
              value={values.initialPassword}
            />
            <p className="field-help" id="user-password-help">
              Use 15–128 Unicode characters. Spaces and pasted text are allowed.
              The account holder must replace this password at first login.
            </p>
          </FormField>
        </div>
      </div>

      <div aria-live="polite" className="form-status" role="status">
        {isSubmitting ? <span>Saving user account…</span> : null}
      </div>
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
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving…" : "Save User"}
        </button>
      </div>
    </form>
  </section>
);

// oxlint-disable-next-line complexity -- this form renders the documented edit and reset states.
const UserEditForm = ({
  fieldErrors,
  isLoading,
  isResetting,
  isSubmitting,
  isResetConfirming,
  loadError,
  onCancel,
  onChange,
  onResetCancel,
  onResetConfirm,
  onResetPasswordChange,
  onResetSubmit,
  onRetry,
  onSubmit,
  resetError,
  resetFieldError,
  resetPassword,
  resetSuccess,
  submitError,
  successMessage,
  user,
  values,
}: {
  fieldErrors: UserFieldErrors;
  isLoading: boolean;
  isResetting: boolean;
  isSubmitting: boolean;
  isResetConfirming: boolean;
  loadError: unknown;
  onCancel: () => void;
  onChange: (field: keyof UserEditFormValues, value: string | boolean) => void;
  onResetCancel: () => void;
  onResetConfirm: () => void;
  onResetPasswordChange: (value: string) => void;
  onResetSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onRetry: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  resetError: string | null;
  resetFieldError: string | null;
  resetPassword: string;
  resetSuccess: string | null;
  submitError: string | null;
  successMessage: string | null;
  user: User | null;
  values: UserEditFormValues | null;
}) => (
  <section
    aria-labelledby="edit-user-heading"
    className="surface-card form-section user-edit-card"
  >
    <div className="section-heading">
      <div>
        <p className="eyebrow">Administrator action</p>
        <h2 id="edit-user-heading">
          {user === null ? "Edit User" : `Edit ${user.displayName}`}
        </h2>
      </div>
      <button
        className="button button-secondary button-small"
        disabled={isSubmitting || isResetting}
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </div>

    {isLoading ? (
      <p aria-live="polite" className="loading-line" role="status">
        Loading account…
      </p>
    ) : null}

    {loadError === null || loadError === undefined ? null : (
      <div className="feedback feedback-error" role="alert">
        <strong>Unable to load account.</strong>
        <span>Refresh the account and try again.</span>
        <button
          className="button button-secondary"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    )}

    {submitError === null ? null : (
      <div className="feedback feedback-error" role="alert">
        <strong>Account update failed.</strong>
        <span>{submitError}</span>
      </div>
    )}
    {successMessage === null ? null : (
      <div className="feedback feedback-success" role="status">
        {successMessage}
      </div>
    )}

    {user !== null && values !== null ? (
      <>
        <form noValidate onSubmit={onSubmit}>
          <div className="form-grid form-grid-two">
            <FormField
              error={fieldErrors.displayName}
              htmlFor="user-display-name"
              label="Name"
              required
            >
              <input
                aria-describedby={fieldDescribedBy(
                  "user-display-name",
                  Boolean(fieldErrors.displayName)
                )}
                aria-invalid={Boolean(fieldErrors.displayName)}
                autoComplete="name"
                disabled={isSubmitting || isResetting}
                id="user-display-name"
                onChange={(event) => {
                  onChange("displayName", event.target.value);
                }}
                value={values.displayName}
              />
            </FormField>

            <FormField
              error={fieldErrors.email}
              htmlFor="user-email"
              label="Email"
              required
            >
              <input
                aria-describedby={fieldDescribedBy(
                  "user-email",
                  Boolean(fieldErrors.email)
                )}
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
                disabled={isSubmitting || isResetting}
                id="user-email"
                inputMode="email"
                onChange={(event) => {
                  onChange("email", event.target.value);
                }}
                type="email"
                value={values.email}
              />
            </FormField>

            <FormField
              error={fieldErrors.role}
              htmlFor="user-role"
              label="Role"
              required
            >
              <select
                aria-describedby={fieldDescribedBy(
                  "user-role",
                  Boolean(fieldErrors.role)
                )}
                aria-invalid={Boolean(fieldErrors.role)}
                disabled={isSubmitting || isResetting}
                id="user-role"
                onChange={(event) => {
                  const role = event.target.value;
                  onChange("role", isUserRole(role) ? role : "");
                }}
                value={values.role}
              >
                <option value="">Choose a role</option>
                {userRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="form-field checkbox-field">
              <span className="field-label">Status</span>
              <label>
                <input
                  checked={values.isActive}
                  disabled={isSubmitting || isResetting}
                  onChange={(event) => {
                    onChange("isActive", event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Active account</span>
              </label>
              <p className="field-help">
                Deactivation revokes every current session for this account.
              </p>
            </div>
          </div>

          <div aria-live="polite" className="form-status" role="status">
            {isSubmitting ? <span>Saving account changes…</span> : null}
          </div>
          <div className="form-actions">
            <button
              className="button button-primary"
              disabled={isSubmitting || isResetting}
              type="submit"
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>

        <section
          aria-labelledby="reset-user-heading"
          className="user-reset-card"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Credential recovery</p>
              <h3 id="reset-user-heading">Set new initial password</h3>
            </div>
          </div>
          <p className="field-help">
            This ends every session for {user.displayName}. The account holder
            must replace the new password at next login.
          </p>
          {resetError === null ? null : (
            <div className="feedback feedback-error" role="alert">
              <strong>Password reset failed.</strong>
              <span>{resetError}</span>
            </div>
          )}
          {resetSuccess === null ? null : (
            <div className="feedback feedback-success" role="status">
              {resetSuccess}
            </div>
          )}
          <form noValidate onSubmit={onResetSubmit}>
            <FormField
              error={resetFieldError ?? undefined}
              htmlFor="reset-initial-password"
              label="New initial password"
              required
            >
              <input
                aria-describedby={fieldDescribedBy(
                  "reset-initial-password",
                  resetFieldError !== null
                )}
                aria-invalid={resetFieldError !== null}
                autoComplete="new-password"
                disabled={isSubmitting || isResetting}
                id="reset-initial-password"
                onChange={(event) => {
                  onResetPasswordChange(event.target.value);
                }}
                type="password"
                value={resetPassword}
              />
            </FormField>
            <div className="form-actions">
              <button
                className="button button-secondary"
                disabled={isSubmitting || isResetting}
                type="submit"
              >
                {isResetting ? "Resetting…" : "Reset Initial Password"}
              </button>
            </div>
          </form>
        </section>
      </>
    ) : null}
    {isResetConfirming ? (
      <div
        aria-describedby="reset-password-confirmation-description"
        aria-labelledby="reset-password-confirmation-title"
        aria-modal="true"
        className="dialog-backdrop"
        role="alertdialog"
      >
        <div className="surface-card confirmation-dialog">
          <p className="eyebrow">Confirm action</p>
          <h2 id="reset-password-confirmation-title">
            Reset initial password?
          </h2>
          <p id="reset-password-confirmation-description">
            Every session for {user?.displayName ?? "this account"} will end,
            and the account holder must replace this password at next login.
          </p>
          <div className="form-actions">
            <button
              autoFocus
              className="button button-secondary"
              disabled={isResetting}
              onClick={onResetCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={isResetting}
              onClick={onResetConfirm}
              type="button"
            >
              {isResetting ? "Resetting…" : "Confirm reset"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </section>
);

// oxlint-disable-next-line complexity -- this page keeps the documented list, form, and recovery states together.
const UserManagementContent = ({
  onAccessError,
  onSessionRevoked,
  principalId,
}: {
  onAccessError: (error: ApiRequestError) => void;
  onSessionRevoked: () => void;
  principalId: number;
}) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<UserListParams>({});
  const [searchDraft, setSearchDraft] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole | "">("");
  const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
  const [values, setValues] = useState<UserFormValues>(initialFormValues);
  const [fieldErrors, setFieldErrors] = useState<UserFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<UserEditFormValues | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<UserFieldErrors>({});
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(
    null
  );
  const [resetPassword, setResetPassword] = useState("");
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const [resetFieldError, setResetFieldError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const usersQuery = useQuery(usersQueryOptions(filters));
  const editUserQuery = useQuery({
    ...userQueryOptions(editingUserId ?? 0, principalId),
    enabled: editingUserId !== null,
  });
  const currentEditValues =
    editValues ??
    (editUserQuery.data?.id === editingUserId
      ? toEditFormValues(editUserQuery.data)
      : null);
  useEffect(() => {
    if (
      usersQuery.error instanceof ApiRequestError &&
      usersQuery.error.status === 403
    ) {
      onAccessError(usersQuery.error);
    }
  }, [onAccessError, usersQuery.error]);

  useEffect(() => {
    if (
      editUserQuery.error instanceof ApiRequestError &&
      editUserQuery.error.status === 403
    ) {
      onAccessError(editUserQuery.error);
    }
  }, [editUserQuery.error, onAccessError]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (values.role === "") {
        throw new Error("Choose a role.");
      }

      return await createUser({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        initialPassword: values.initialPassword,
        isActive: values.isActive,
        role: values.role,
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 403) {
        onAccessError(error);
        return;
      }
      setFieldErrors(getUserFieldErrors(error));
      setSubmitError(getUserErrorMessage(error));
      setSuccessMessage(null);
    },
    onSuccess: async (user) => {
      setFieldErrors({});
      setSubmitError(null);
      setSuccessMessage(
        `${user.displayName} was created. The initial password must be replaced at first login.`
      );
      setValues(initialFormValues);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (editingUserId === null || currentEditValues === null) {
        throw new Error("Choose a user to edit.");
      }

      if (currentEditValues.role === "") {
        throw new Error("Choose a role.");
      }

      return await updateUser(editingUserId, {
        displayName: currentEditValues.displayName.trim(),
        email: currentEditValues.email.trim(),
        isActive: currentEditValues.isActive,
        role: currentEditValues.role,
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 403) {
        onAccessError(error);
        return;
      }

      setEditFieldErrors(getUserFieldErrors(error));
      setEditSubmitError(getUserErrorMessage(error));
      setEditSuccessMessage(null);
    },
    onSuccess: async (user) => {
      setEditFieldErrors({});
      setEditSubmitError(null);

      if (user.id === principalId && user.role !== "Administrator") {
        onSessionRevoked();
        return;
      }

      setEditSuccessMessage(`${user.displayName} was updated successfully.`);
      setEditValues(toEditFormValues(user));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (editingUserId === null) {
        throw new Error("Choose a user to edit.");
      }

      return await resetUserInitialPassword(editingUserId, {
        confirmed: true,
        initialPassword: resetPassword,
      });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 403) {
        onAccessError(error);
        return;
      }

      setResetFieldError(getUserFieldErrors(error).initialPassword ?? null);
      setResetError(getUserErrorMessage(error));
      setResetSuccess(null);
      setIsResetConfirmationOpen(false);
    },
    onSuccess: async (user) => {
      setResetPassword("");
      setIsResetConfirmationOpen(false);
      setResetFieldError(null);

      if (user.id === principalId) {
        onSessionRevoked();
        return;
      }

      setResetError(null);
      setResetSuccess(
        `${user.displayName}'s initial password was reset. All sessions ended; replacement is required at next login.`
      );
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    retry: false,
  });

  const hasFilters = filters.search !== undefined || filters.role !== undefined;

  const updateField = <Field extends keyof UserFormValues>(
    field: Field,
    value: UserFormValues[Field]
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const submitSearch = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = searchDraft.trim();

    // oxlint-disable-next-line unicorn/prefer-spread -- user contract counts Unicode code points.
    if (Array.from(search).length > MAX_USER_SEARCH_LENGTH) {
      setSearchError("Search must contain at most 200 Unicode characters.");
      document.querySelector<HTMLElement>("#user-search")?.focus();
      return;
    }

    setSearchError(null);
    setFilters({
      ...(roleDraft === "" ? {} : { role: roleDraft }),
      ...(search.length === 0 ? {} : { search }),
    });
  };

  const updateRoleFilter = (value: string) => {
    const role = value === "" || !isUserRole(value) ? "" : value;
    setRoleDraft(role);
    setFilters((current) => ({
      ...current,
      ...(role === "" ? { role: undefined } : { role }),
    }));
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearchError(null);
    setRoleDraft("");
    setFilters({});
  };

  const openCreateForm = () => {
    setEditingUserId(null);
    setEditValues(null);
    setIsCreateFormVisible(true);
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const closeCreateForm = () => {
    setIsCreateFormVisible(false);
    setValues(initialFormValues);
    setFieldErrors({});
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const openEditForm = (user: User) => {
    setIsCreateFormVisible(false);
    setEditingUserId(user.id);
    setEditValues(null);
    setEditFieldErrors({});
    setEditSubmitError(null);
    setEditSuccessMessage(null);
    setResetPassword("");
    setIsResetConfirmationOpen(false);
    setResetFieldError(null);
    setResetError(null);
    setResetSuccess(null);
  };

  const closeEditForm = () => {
    setEditingUserId(null);
    setEditValues(initialEditFormValues);
    setEditFieldErrors({});
    setEditSubmitError(null);
    setEditSuccessMessage(null);
    setResetPassword("");
    setIsResetConfirmationOpen(false);
    setResetFieldError(null);
    setResetError(null);
    setResetSuccess(null);
  };

  const submitCreateUser = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateUserForm(values);
    setFieldErrors(errors);
    setSubmitError(null);
    setSuccessMessage(null);

    if (Object.keys(errors).length > 0) {
      focusFirstUserFieldError(errors);
      return;
    }

    createMutation.mutate();
  };

  const updateEditField = <Field extends keyof UserEditFormValues>(
    field: Field,
    value: UserEditFormValues[Field]
  ) => {
    setEditValues((current) => {
      const baseValues =
        current ??
        (editUserQuery.data === undefined
          ? null
          : toEditFormValues(editUserQuery.data));
      return baseValues === null
        ? baseValues
        : { ...baseValues, [field]: value };
    });
    setEditFieldErrors((current) => ({ ...current, [field]: undefined }));
    setEditSubmitError(null);
    setEditSuccessMessage(null);
  };

  const submitEditUser = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (currentEditValues === null) {
      return;
    }

    const errors = validateUserEditForm(currentEditValues);
    setEditFieldErrors(errors);
    setEditSubmitError(null);
    setEditSuccessMessage(null);

    if (Object.keys(errors).length > 0) {
      focusFirstUserFieldError(errors);
      return;
    }

    updateMutation.mutate();
  };

  const updateResetPassword = (value: string) => {
    setResetPassword(value);
    setResetFieldError(null);
    setResetError(null);
    setResetSuccess(null);
  };

  const submitReset = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // oxlint-disable-next-line unicorn/prefer-spread -- reset validation counts Unicode code points.
    const { length } = Array.from(resetPassword);

    if (length < 15 || length > 128) {
      setResetFieldError(
        "Initial password must contain 15–128 Unicode characters."
      );
      document.querySelector<HTMLElement>("#reset-initial-password")?.focus();
      return;
    }

    setResetFieldError(null);
    setResetError(null);
    setResetSuccess(null);
    setIsResetConfirmationOpen(true);
  };

  const confirmReset = () => {
    resetMutation.mutate();
  };

  const users = usersQuery.isError ? [] : (usersQuery.data ?? []);

  return (
    <AppShell
      allowedRoles={["Administrator"]}
      eyebrow="Administration"
      title="User Management"
    >
      <div className="page-actions">
        <p className="page-description">
          Find accounts by name or email, filter by role, and issue one-role
          accounts with a password that must be replaced at first login.
        </p>
        <button
          className="button button-primary"
          onClick={openCreateForm}
          type="button"
        >
          Create User
        </button>
      </div>

      <section
        aria-labelledby="user-filters-heading"
        className="surface-card filter-card"
      >
        <div className="section-heading">
          <div>
            <h2 id="user-filters-heading">Find users</h2>
            <p className="page-description">
              Search is case-insensitive and matches part of a name or email.
            </p>
          </div>
          {hasFilters ? (
            <span className="result-count">Filters active</span>
          ) : null}
        </div>
        <form className="user-filter-form" onSubmit={submitSearch}>
          <FormField
            error={searchError ?? undefined}
            htmlFor="user-search"
            label="Search name or email"
          >
            <input
              aria-describedby={fieldDescribedBy(
                "user-search",
                searchError !== null
              )}
              aria-invalid={searchError !== null}
              id="user-search"
              onChange={(event) => {
                setSearchDraft(event.target.value);
                setSearchError(null);
              }}
              placeholder="e.g. ada@example.test"
              type="search"
              value={searchDraft}
            />
          </FormField>
          <div className="filter-field">
            <label htmlFor="user-role-filter">Role</label>
            <select
              id="user-role-filter"
              onChange={(event) => {
                updateRoleFilter(event.target.value);
              }}
              value={roleDraft}
            >
              <option value="">All roles</option>
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row user-filter-actions">
            <button className="button button-primary" type="submit">
              Search
            </button>
            <button
              className="button button-secondary"
              disabled={!hasFilters && searchDraft.trim().length === 0}
              onClick={clearFilters}
              type="button"
            >
              Clear Filters
            </button>
          </div>
        </form>
      </section>

      {isCreateFormVisible ? (
        <UserCreateForm
          fieldErrors={fieldErrors}
          isSubmitting={createMutation.isPending}
          onCancel={closeCreateForm}
          onChange={updateField}
          onSubmit={submitCreateUser}
          submitError={submitError}
          successMessage={successMessage}
          values={values}
        />
      ) : null}

      {editingUserId !== null && (
        <UserEditForm
          fieldErrors={editFieldErrors}
          isLoading={editUserQuery.isPending}
          isResetConfirming={isResetConfirmationOpen}
          isResetting={resetMutation.isPending}
          isSubmitting={updateMutation.isPending}
          loadError={editUserQuery.error}
          onCancel={closeEditForm}
          onChange={updateEditField}
          onResetCancel={() => {
            setIsResetConfirmationOpen(false);
          }}
          onResetConfirm={confirmReset}
          onResetPasswordChange={updateResetPassword}
          onResetSubmit={submitReset}
          onRetry={() => void editUserQuery.refetch()}
          onSubmit={submitEditUser}
          resetError={resetError}
          resetFieldError={resetFieldError}
          resetPassword={resetPassword}
          resetSuccess={resetSuccess}
          submitError={editSubmitError}
          successMessage={editSuccessMessage}
          user={editUserQuery.data ?? null}
          values={currentEditValues}
        />
      )}

      <section
        aria-busy={usersQuery.isPending || usersQuery.isFetching}
        aria-labelledby="user-list-heading"
        className="surface-card user-list-card"
      >
        <div className="section-heading list-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2 id="user-list-heading">User accounts</h2>
          </div>
          {usersQuery.isSuccess ? (
            <span className="result-count">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          ) : null}
        </div>

        <div aria-live="polite" className="list-status" role="status">
          {usersQuery.isFetching && !usersQuery.isPending ? (
            <span>Refreshing users…</span>
          ) : null}
        </div>

        {usersQuery.isPending ? (
          <p aria-live="polite" className="loading-line" role="status">
            Loading users…
          </p>
        ) : null}

        {usersQuery.isError ? (
          <div className="feedback feedback-error" role="alert">
            <strong>Unable to load users.</strong>
            <span>{getUserListErrorMessage(usersQuery.error)}</span>
            <button
              className="button button-secondary"
              onClick={() => void usersQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {usersQuery.isSuccess && users.length === 0 && !hasFilters ? (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-icon">
              <Icon icon={UserGroupIcon} />
            </div>
            <h3>No user accounts yet</h3>
            <p>Create the first account to give a user access to TokTickIT.</p>
            <button
              className="button button-primary"
              onClick={openCreateForm}
              type="button"
            >
              Create User
            </button>
          </div>
        ) : null}

        {usersQuery.isSuccess && users.length === 0 && hasFilters ? (
          <div className="empty-state">
            <div aria-hidden="true" className="empty-icon">
              <Icon icon={Search01Icon} />
            </div>
            <h3>No matching users</h3>
            <p>Try a different search or remove the active filters.</p>
            <button
              className="button button-secondary"
              onClick={clearFilters}
              type="button"
            >
              Clear Filters
            </button>
          </div>
        ) : null}

        {usersQuery.isSuccess && users.length > 0 ? (
          <>
            <UserTable onEdit={openEditForm} users={users} />
            <UserCards onEdit={openEditForm} users={users} />
          </>
        ) : null}
      </section>
    </AppShell>
  );
};

export const UserManagementPage = () => {
  const { refetchAuth, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accessError, setAccessError] = useState<ApiRequestError | null>(null);
  const handledAccessError = useRef<ApiRequestError | null>(null);

  useEffect(() => {
    if (accessError === null || handledAccessError.current === accessError) {
      return;
    }
    handledAccessError.current = accessError;
    // The content is unmounted before clearing all cached directory results.
    void queryClient.cancelQueries({ queryKey: ["users"] });
    queryClient.removeQueries({ queryKey: ["users"] });
    void queryClient.cancelQueries({ queryKey: ["user"] });
    queryClient.removeQueries({ queryKey: ["user"] });
    void refetchAuth();
    if (accessError.code === "PASSWORD_CHANGE_REQUIRED") {
      void navigate({ replace: true, to: "/change-password" });
    }
  }, [accessError, navigate, queryClient, refetchAuth]);

  if (accessError !== null) {
    return accessError.code === "PASSWORD_CHANGE_REQUIRED" ? (
      <AuthLoading />
    ) : (
      <AccessDenied />
    );
  }

  if (user === null || user.mustChangePassword) {
    return <AuthRequired />;
  }

  if (user.role !== "Administrator") {
    return <AccessDenied />;
  }

  const handleSessionRevoked = () => {
    void queryClient.cancelQueries({ queryKey: ["users"] });
    queryClient.removeQueries({ queryKey: ["users"] });
    void queryClient.cancelQueries({ queryKey: ["user"] });
    queryClient.removeQueries({ queryKey: ["user"] });
    void refetchAuth();
    void navigate({ replace: true, to: "/login" });
  };

  return (
    <UserManagementContent
      key={user.id}
      onAccessError={setAccessError}
      onSessionRevoked={handleSessionRevoked}
      principalId={user.id}
    />
  );
};
