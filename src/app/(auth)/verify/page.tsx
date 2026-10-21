import Link from "next/link";
import { redirect } from "next/navigation";
import { peekToken, verifyEmail } from "@/server/services/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { resendVerificationAction } from "../actions";
import { SetPasswordForm } from "../reset-password/set-password-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Account verification") };
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { t } = await getI18n();
  const { token } = await searchParams;
  if (token) {
    const info = await peekToken(token, ["INVITATION", "EMAIL_VERIFICATION"]);
    if (info.valid && info.type === "INVITATION") {
      return (
        <div>
          <h2 className="font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("Activate your account")}</h2>
          <p className="mt-2 text-ink-muted">{t("Welcome, {name}. Choose a password for {email}.", { name: info.name, email: info.email })}</p>
          <SetPasswordForm token={token} cta={t("Activate account")} />
        </div>
      );
    }
    if (info.valid && info.type === "EMAIL_VERIFICATION") {
      await verifyEmail(token);
      redirect("/login?verified=1");
    }
  }
  return (
    <div>
      <h2 className="font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("Account verification")}</h2>
      {token && <div className="mt-4"><Notice tone="warn" title={t("Link invalid or expired")}>{t("Request a new verification link below.")}</Notice></div>}
      <p className="mt-3 text-ink-muted">{t("Enter your email address to receive a new verification link.")}</p>
      <ActionForm action={resendVerificationAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block font-sans text-[0.8125rem] font-semibold">{t("Email address")}</label>
          <input id="email" name="email" type="email" required dir="ltr" className="input-base h-12 !rounded-full" />
        </div>
        <SubmitButton className="h-12 w-full">{t("Send verification link")}</SubmitButton>
      </ActionForm>
      <p className="mt-6 font-sans text-sm"><Link href="/login">{t("Back to sign in")}</Link></p>
    </div>
  );
}
