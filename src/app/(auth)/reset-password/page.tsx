import Link from "next/link";
import { peekToken } from "@/server/services/auth";
import { Notice } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Set a new password") };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { t } = await getI18n();
  const { token } = await searchParams;
  const info = token ? await peekToken(token, ["PASSWORD_RESET"]) : { valid: false as const };
  return (
    <div>
      <h2 className="font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("Set a new password")}</h2>
      {!info.valid ? (
        <div className="mt-6 space-y-4">
          <Notice tone="warn" title={t("Link invalid or expired")}>{t("Reset links are valid for 60 minutes and can be used once.")}</Notice>
          <p className="font-sans text-sm"><Link href="/forgot-password">{t("Request a new link")}</Link></p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-ink-muted">{t("For {email}. Signing in again will be required on all devices.", { email: info.email })}</p>
          <SetPasswordForm token={token!} cta={t("Update password")} />
        </>
      )}
    </div>
  );
}
