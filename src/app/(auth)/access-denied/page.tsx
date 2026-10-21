import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Access denied") };
}

export default async function AccessDenied() {
  const { t } = await getI18n();
  return (
    <div>
      <p className="type-eyebrow">{t("Error 403")}</p>
      <h2 className="mt-1 font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("You do not have access to this page")}</h2>
      <p className="mt-2 text-ink-muted">{t("Your role does not include permission for this area. If you believe you need access, ask your line manager or the L&D administrator to review your role assignment.")}</p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/dashboard">{t("Go to dashboard")}</LinkButton>
        <LinkButton href="/help" variant="secondary">{t("Help and support")}</LinkButton>
      </div>
      <p className="mt-6 font-sans text-sm"><Link href="/login">{t("Sign in with a different account")}</Link></p>
    </div>
  );
}
