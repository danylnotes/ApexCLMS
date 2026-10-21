import Link from "next/link";
import { Notice } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Corporate single sign-on") };
}

/**
 * Integration boundary for Microsoft Entra ID (OpenID Connect).
 * The redirect/callback flow is NOT implemented in this release; this page reports configuration
 * state honestly rather than presenting a non-functional button. See docs/DEPLOYMENT.md § SSO.
 */
export default async function SsoPage() {
  const { t } = await getI18n();
  const configured = !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
  return (
    <div>
      <h2 className="font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("Corporate single sign-on")}</h2>
      <div className="mt-6">
        {configured ? (
          <Notice tone="warn" title={t("Credentials present, flow not enabled")}>
            {t("Entra ID credentials are configured, but the OpenID Connect callback is not enabled in this release. Your administrator must complete the integration described in the deployment guide.")}
          </Notice>
        ) : (
          <Notice tone="info" title={t("Single sign-on is not configured")}>
            {t("This organisation signs in with staff ID and password. Single sign-on with Microsoft Entra ID can be enabled by IT — see the deployment guide.")}
          </Notice>
        )}
      </div>
      <p className="mt-6 font-sans text-sm"><Link href="/login">{t("Sign in with staff ID and password")}</Link></p>
    </div>
  );
}
