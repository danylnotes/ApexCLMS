"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "../actions";
import { SubmitButton } from "@/components/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, { ok: null });
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1">
        <label htmlFor="email" className="block font-sans text-[0.8125rem] font-medium">Email address</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input-base" aria-describedby={state.ok === false ? "login-error" : undefined} />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="block font-sans text-[0.8125rem] font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input-base" />
      </div>
      {state.ok === false && (
        <p id="login-error" role="alert" className="rounded border border-crit/30 bg-crit-50 px-3 py-2 font-sans text-[0.8125rem] text-crit">
          {state.error}
          {state.data?.code === "UNVERIFIED" && (
            <>
              {" "}
              <Link href="/verify">Resend verification</Link>
            </>
          )}
        </p>
      )}
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
