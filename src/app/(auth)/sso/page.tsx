import Link from "next/link";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Corporate single sign-on" };

/**
 * Integration boundary for Microsoft Entra ID (OpenID Connect).
 * The redirect/callback flow is NOT implemented in this release; this page reports configuration
 * state honestly rather than presenting a non-functional button. See docs/DEPLOYMENT.md § SSO.
 */
export default function SsoPage() {
  const configured = !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);
  return (
    <div>
      <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Corporate single sign-on</h2>
      <div className="mt-6">
        {configured ? (
          <Notice tone="warn" title="Credentials present, flow not enabled">
            Entra ID credentials are configured, but the OpenID Connect callback is not enabled in this release. Your administrator must complete the integration described in the deployment guide.
          </Notice>
        ) : (
          <Notice tone="info" title="Single sign-on is not configured">
            This organisation signs in with email and password. Single sign-on with Microsoft Entra ID can be enabled by IT — see the deployment guide.
          </Notice>
        )}
      </div>
      <p className="mt-6 font-sans text-sm"><Link href="/login">Sign in with email and password</Link></p>
    </div>
  );
}
