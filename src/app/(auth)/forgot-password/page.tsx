import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { getI18n } from "@/i18n/server";
import { forgotPasswordAction } from "../actions";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Forgot password") };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <div>
      <h2 className="font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("Reset your password")}</h2>
      <p className="mt-2 text-ink-muted">{t("Enter your corporate email address. If an active account exists, we will send a single-use reset link.")}</p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block font-sans text-[0.8125rem] font-semibold">{t("Email address")}</label>
          <input id="email" name="email" type="email" required autoComplete="username" dir="ltr" className="input-base h-12 !rounded-full" />
        </div>
        <SubmitButton className="h-12 w-full">{t("Send reset link")}</SubmitButton>
      </ActionForm>
      <p className="mt-6 font-sans text-sm"><Link href="/login">{t("Back to sign in")}</Link></p>
    </div>
  );
}
