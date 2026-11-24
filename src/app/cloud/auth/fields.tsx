"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";

type Base = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  /** Shown under the input and announced with it. */
  hint?: string;
  /** Field-level error; marks the input invalid and is announced. */
  error?: string;
  /** Id of a form-level message that also describes this field. */
  describedBy?: string;
  /** Something to sit at the end of the label row, e.g. "Forgot password?". */
  aside?: ReactNode;
  readOnly?: boolean;
};

function describe(id: string, { hint, error, describedBy }: Pick<Base, "hint" | "error" | "describedBy">) {
  const ids = [error && `${id}-error`, hint && `${id}-hint`, describedBy].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function Messages({ id, hint, error }: Pick<Base, "id" | "hint" | "error">) {
  return (
    <>
      {error && (
        <p className="bc-field-error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
      {hint && (
        <p className="bc-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </>
  );
}

export function TextField({
  type = "text",
  inputMode,
  ...props
}: Base & { type?: "text" | "email"; inputMode?: "email" | "text" }) {
  const { id, label, value, onChange, autoComplete, error, aside, readOnly } = props;
  return (
    <div className="field bc-field">
      <div className="bc-field-head">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCapitalize={type === "email" ? "none" : undefined}
        value={value}
        readOnly={readOnly}
        aria-invalid={error || props.describedBy ? true : undefined}
        aria-describedby={describe(id, props)}
        onChange={(e) => onChange(e.target.value)}
      />
      <Messages id={id} hint={props.hint} error={error} />
    </div>
  );
}

export function PasswordField(props: Base) {
  const { id, label, value, onChange, autoComplete, error, aside, readOnly } = props;
  const [shown, setShown] = useState(false);
  return (
    <div className="field bc-field">
      <div className="bc-field-head">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="bc-password">
        <input
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          readOnly={readOnly}
          aria-invalid={error || props.describedBy ? true : undefined}
          aria-describedby={describe(id, props)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="bc-reveal" aria-controls={id} onClick={() => setShown((v) => !v)}>
          <Icon name={shown ? "eyeOff" : "eye"} size={18} />
          {shown ? "Hide" : "Show"}
          <span className="sr-only"> password</span>
        </button>
      </div>
      <Messages id={id} hint={props.hint} error={error} />
    </div>
  );
}

/** Primary submit with a busy state that keeps focus (aria-disabled rather than disabled). */
export function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <>
      <button className="button bc-submit" type="submit" aria-disabled={busy || undefined}>
        {busy && <span className="bc-spinner" aria-hidden="true" />}
        {busy ? busyLabel : label}
      </button>
      <span className="sr-only" role="status">
        {busy ? busyLabel : ""}
      </span>
    </>
  );
}

/** A form-level message (errors that don't belong to one field). */
export function FormError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="bc-form-error" id={id} role="alert">
      <Icon name="alert" size={18} />
      <p>{children}</p>
    </div>
  );
}

export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
