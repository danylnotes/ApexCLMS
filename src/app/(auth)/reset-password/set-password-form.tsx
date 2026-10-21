"use client";

import { ActionForm, SubmitButton } from "@/components/forms";
import { useI18n } from "@/i18n/client";
import { resetPasswordAction } from "../actions";

export function SetPasswordForm({ token, cta }: { token: string; cta: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={resetPasswordAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-1.5">
        <label htmlFor="password" className="block font-sans text-[0.8125rem] font-semibold">{t("New password")}</label>
        <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="input-base h-12 !rounded-full" aria-describedby="pw-hint" />
        <p id="pw-hint" className="text-[0.8125rem] text-ink-faint">{t("At least 12 characters, including upper and lower case letters, a number and a symbol.")}</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block font-sans text-[0.8125rem] font-semibold">{t("Confirm new password")}</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input-base h-12 !rounded-full" />
      </div>
      <SubmitButton className="h-12 w-full">{cta}</SubmitButton>
    </ActionForm>
  );
}
