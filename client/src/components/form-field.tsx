import type { ReactNode } from "react";

import { cn } from "@/lib/class-names";

interface FormFieldProps {
  children: ReactNode;
  error?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}

export const FormField = ({
  children,
  error,
  htmlFor,
  label,
  required = false,
}: FormFieldProps) => {
  const errorId = `${htmlFor}-error`;

  return (
    <div
      className={cn(
        "form-field",
        error !== undefined && error.length > 0 && "has-error"
      )}
    >
      <label htmlFor={htmlFor}>
        {label}{" "}
        {required ? (
          <span aria-hidden="true" className="required-mark">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error !== undefined && error.length > 0 ? (
        <p className="field-error" id={errorId} role="alert">
          <span aria-hidden="true">!</span> {error}
        </p>
      ) : null}
    </div>
  );
};

export const fieldDescribedBy = (fieldId: string, hasError: boolean) =>
  hasError ? `${fieldId}-error` : undefined;

interface ReadOnlyFieldProps {
  label: string;
  value: string;
}

export const ReadOnlyField = ({ label, value }: ReadOnlyFieldProps) => (
  <div className="form-field readonly-field">
    <span className="field-label">{label}</span>
    <output>{value.length > 0 ? value : "—"}</output>
  </div>
);
