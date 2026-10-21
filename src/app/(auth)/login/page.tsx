import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { Notice } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Sign in") };
}

/** Fictional demonstration personas (DEMO_MODE only). */
const DEMO_ACCOUNTS = [
  { staffId: "D-20101", who: "Lina Saleh", role: "Field Operator · new starter" },
  { staffId: "D-20104", who: "Aisha Rahman", role: "Field Operator · on a learning path" },
  { staffId: "D-20103", who: "Daniel Reyes", role: "Senior Operator · overdue training" },
  { staffId: "D-20109", who: "Kwame Mensah", role: "Promoted · next level awaiting admin" },
  { staffId: "D-20102", who: "James Okafor", role: "Senior Process Engineer" },
  { staffId: "D-20105", who: "Priya Natarajan", role: "Reliability Engineer · pending CPD" },
  { staffId: "D-10003", who: "Omar Haddad", role: "Line manager" },
  { staffId: "D-10004", who: "Graham Whitfield", role: "Instructor" },
  { staffId: "D-10001", who: "Dr Helen Mercer", role: "L&D administrator" },
  { staffId: "D-10002", who: "Catherine Lowe", role: "Executive / HR" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getActor()) redirect("/dashboard");
  const { t } = await getI18n();
  const { branding } = await getSettings();
  const ssoConfigured = !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID);
  return (
    <div>
      <p className="font-sans text-[0.8125rem] font-semibold text-copper">{t("Welcome to {product}", { product: branding.productName })}</p>
      <h2 className="mt-1 font-sans text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-ink">{t("Sign in")}</h2>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">{t("Use your staff ID. It links to your job title, so you see the learning content for the levels your administrator has opened.")}</p>
      <div className="mt-5 space-y-3">
        {sp.reset && <Notice tone="ok">{t("Your password has been updated. All other sessions were signed out.")}</Notice>}
        {sp.activated && <Notice tone="ok">{t("Your account is active. Sign in with your staff ID and new password.")}</Notice>}
        {sp.signedOut && <Notice tone="info">{t("You have signed out.")}</Notice>}
        {sp.verified && <Notice tone="ok">{t("Your email address has been verified.")}</Notice>}
      </div>
      <LoginForm next={sp.next ?? "/dashboard"} demoAccounts={process.env.DEMO_MODE === "true" ? DEMO_ACCOUNTS.map((d) => ({ ...d, role: t(d.role) })) : []} />
      <div className="mt-6 flex items-center justify-between font-sans text-sm">
        <Link href="/forgot-password" className="font-medium text-ink">{t("Forgot your password?")}</Link>
        <Link href="/sso" className="text-ink-muted">
          {ssoConfigured ? t("Single sign-on") : t("Single sign-on (not configured)")}
        </Link>
      </div>
      <p className="mt-8 font-sans text-[0.75rem] text-ink-faint">
        {t("Need help? Contact")} <a href={`mailto:${branding.supportEmail}`} dir="ltr">{branding.supportEmail}</a>
      </p>
    </div>
  );
}
