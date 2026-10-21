"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { buttonClass } from "./ui";
import type { ActionState } from "@/lib/action-state";
import { useI18n } from "@/i18n/client";

export function SubmitButton({ children, variant = "primary", size = "md", pendingLabel, className, name, value, confirm }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md"; pendingLabel?: string; className?: string; name?: string; value?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel ?? t("Working…") : children}
    </button>
  );
}

/** Form bound to a server action; shows success or validation errors returned by the server. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  inline,
  id,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: null } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} id={id} noValidate={false}>
      {children}
      {state.ok != null && (state.message || state.error) && (
        <p role={state.ok ? "status" : "alert"} className={clsx("font-sans text-[0.8125rem]", inline ? "mt-1" : "mt-3", state.ok ? "text-ok" : "text-crit")}>
          {state.ok ? state.message : state.error}
        </p>
      )}
      {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
        <ul className="mt-2 list-disc ps-5 font-sans text-[0.8125rem] text-crit">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>{v?.[0]}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
