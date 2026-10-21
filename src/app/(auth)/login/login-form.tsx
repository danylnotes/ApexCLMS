"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Eye, EyeOff, IdCard, LockKeyhole } from "lucide-react";
import { loginAction } from "../actions";
import { SubmitButton } from "@/components/forms";
import { useI18n } from "@/i18n/client";

export function LoginForm({ next, demoAccounts }: { next: string; demoAccounts: { staffId: string; who: string; role: string }[] }) {
  const [state, action] = useActionState(loginAction, { ok: null });
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  const staffRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="staffId" className="block font-sans text-[0.8125rem] font-semibold">{t("Staff ID")}</label>
          <div className="relative">
            <IdCard className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" aria-hidden />
            <input ref={staffRef} id="staffId" name="staffId" autoComplete="username" autoCapitalize="characters" spellCheck={false} required placeholder={t("e.g. D-20101")} className="input-base h-12 !rounded-full !ps-11 uppercase placeholder:normal-case" aria-describedby={state.ok === false ? "login-error" : "staff-hint"} />
          </div>
          <p id="staff-hint" className="font-sans text-[0.75rem] text-ink-faint">{t("Printed on your staff badge.")}</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="block font-sans text-[0.8125rem] font-semibold">{t("Password")}</label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" aria-hidden />
            <input ref={pwRef} id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="input-base h-12 !rounded-full !ps-11 !pe-12" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint hover:bg-canvas hover:text-ink" aria-label={show ? t("Hide password") : t("Show password")} aria-pressed={show}>
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
        {state.ok === false && (
          <p id="login-error" role="alert" className="rounded-2xl bg-crit-50 px-4 py-3 font-sans text-[0.8125rem] text-crit">
            {state.error}
            {state.data?.code === "UNVERIFIED" && (
              <>
                {" "}
                <Link href="/verify">{t("Resend verification")}</Link>
              </>
            )}
          </p>
        )}
        <SubmitButton className="h-12 w-full text-[0.9375rem]" pendingLabel={t("Signing in…")}>{t("Sign in")}</SubmitButton>
      </form>
      {demoAccounts.length > 0 && (
        <details className="mt-8 rounded-2xl bg-canvas px-4 py-3 font-sans text-[0.8125rem]">
          <summary className="cursor-pointer font-semibold text-ink">{t("Demonstration staff IDs (fictional)")}</summary>
          <p className="mt-2 text-ink-muted">{t("All use the password {password}. Choose one to fill the form.", { password: "Demo#Apex2026!" })}</p>
          <ul className="mt-2 grid gap-1">
            {demoAccounts.map((d) => (
              <li key={d.staffId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-surface"
                  onClick={() => {
                    if (staffRef.current) staffRef.current.value = d.staffId;
                    if (pwRef.current) pwRef.current.value = "Demo#Apex2026!";
                    pwRef.current?.focus();
                  }}
                >
                  <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-[0.75rem] font-semibold text-navy">{d.staffId}</span>
                  <span className="min-w-0"><span className="font-medium text-ink">{d.who}</span> <span className="text-ink-muted">· {d.role}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
