import { Clock01Icon, Login01Icon } from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";

import { ApiConnectionError } from "@/api/client";
import { ApiRequestError } from "@/api/errors";
import { fieldDescribedBy, FormField } from "@/components/form-field";
import { Icon } from "@/components/icon";
import { useAuth } from "@/context/auth";
import { validateLogin } from "@/lib/auth-rules";
import type { LoginFieldErrors } from "@/lib/auth-rules";

const getLoginErrorMessage = (error: unknown): string => {
  if (error instanceof ApiConnectionError) {
    return "Unable to connect to the TokTickIT API. Check the server and retry.";
  }

  if (error instanceof ApiRequestError && error.message.length > 0) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Unable to sign in. Check your credentials or contact your administrator.";
};

const getRetryAfterSeconds = (error: unknown): number | null => {
  if (!(error instanceof ApiRequestError) || error.status !== 429) {
    return null;
  }

  return error.retryAfterSeconds ?? 1;
};

const LoginBrand = () => (
  <header className="auth-header">
    <div className="auth-header-inner">
      <span className="brand">
        <span aria-hidden="true" className="brand-mark">
          <Icon icon={Clock01Icon} />
        </span>
        <span>TokTickIT</span>
      </span>
      <span className="auth-header-label">IT service desk</span>
    </div>
  </header>
);

export const LoginPage = () => {
  const navigate = useNavigate();
  const { authError, isLoading, login, user, refetchAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user !== null) {
      if (user.mustChangePassword) {
        void navigate({ to: "/change-password" });
      } else if (user.role === "Requester") {
        void navigate({ to: "/tickets" });
      } else {
        void navigate({ to: "/" });
      }
    }
  }, [navigate, user]);

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

  if (isLoading) {
    return (
      <div className="auth-page">
        <LoginBrand />
        <main className="auth-main">
          <p aria-live="polite" className="loading-line" role="status">
            Checking your session…
          </p>
        </main>
      </div>
    );
  }

  if (user !== null) {
    return null;
  }

  const updateField = (field: keyof LoginFieldErrors, value: string) => {
    if (field === "email") {
      setEmail(value);
    } else {
      setPassword(value);
    }
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    setSubmitError(null);
    setRetryAfterSeconds(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const nextAuth = await login({ email: email.trim(), password });
      setPassword("");
      if (nextAuth.user.mustChangePassword) {
        void navigate({ to: "/change-password" });
      } else if (nextAuth.user.role === "Requester") {
        void navigate({ to: "/tickets" });
      } else {
        void navigate({ to: "/" });
      }
    } catch (error: unknown) {
      setSubmitError(getLoginErrorMessage(error));
      setRetryAfterSeconds(getRetryAfterSeconds(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <LoginBrand />
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="login-heading">
          <div className="auth-card-header">
            <div aria-hidden="true" className="auth-icon">
              <Icon icon={Login01Icon} />
            </div>
            <h1 id="login-heading">Sign in to TokTickIT</h1>
            <p>Use your TokTickIT account to access the service desk.</p>
          </div>

          <div className="auth-card-body">
            {authError === null ? null : (
              <div className="feedback feedback-warning" role="alert">
                <strong>Session check failed.</strong>
                <span>Sign in below or retry the session check.</span>
                <button
                  className="button button-secondary"
                  onClick={() => void refetchAuth()}
                  type="button"
                >
                  Retry session check
                </button>
              </div>
            )}

            {submitError === null ? null : (
              <div className="feedback feedback-error" role="alert">
                <strong>Sign-in failed.</strong>
                <span>{submitError}</span>
                {retryAfterSeconds === null ? null : (
                  <span>
                    Try again in {retryAfterSeconds} second
                    {retryAfterSeconds === 1 ? "" : "s"}.
                  </span>
                )}
              </div>
            )}

            <form
              noValidate
              onSubmit={(event) => {
                void submit(event);
              }}
            >
              <FormField
                error={fieldErrors.email}
                htmlFor="login-email"
                label="Email"
                required
              >
                <input
                  aria-describedby={fieldDescribedBy(
                    "login-email",
                    Boolean(fieldErrors.email)
                  )}
                  aria-invalid={Boolean(fieldErrors.email)}
                  autoComplete="username"
                  disabled={isSubmitting || retryAfterSeconds !== null}
                  id="login-email"
                  inputMode="email"
                  onChange={(event) => {
                    updateField("email", event.target.value);
                  }}
                  type="email"
                  value={email}
                />
              </FormField>

              <FormField
                error={fieldErrors.password}
                htmlFor="login-password"
                label="Password"
                required
              >
                <div className="password-input-row">
                  <input
                    aria-describedby={fieldDescribedBy(
                      "login-password",
                      Boolean(fieldErrors.password)
                    )}
                    aria-invalid={Boolean(fieldErrors.password)}
                    autoComplete="current-password"
                    disabled={isSubmitting || retryAfterSeconds !== null}
                    id="login-password"
                    onChange={(event) => {
                      updateField("password", event.target.value);
                    }}
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="button button-secondary password-toggle"
                    disabled={isSubmitting}
                    onClick={() => {
                      setShowPassword((current) => !current);
                    }}
                    type="button"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </FormField>

              <p className="auth-help">
                If you cannot sign in, contact your TokTickIT administrator.
              </p>
              <button
                className="button button-primary auth-submit"
                disabled={isSubmitting || retryAfterSeconds !== null}
                type="submit"
              >
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};
