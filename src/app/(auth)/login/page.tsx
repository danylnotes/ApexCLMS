import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { Notice } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getActor()) redirect("/dashboard");
  const { branding } = await getSettings();
  const ssoConfigured = !!(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID);
  return (
    <div>
      <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Sign in</h2>
      <p className="mt-1 text-ink-muted">Use your corporate email address.</p>
      <div className="mt-6 space-y-3">
        {sp.reset && <Notice tone="ok">Your password has been updated. All other sessions were signed out.</Notice>}
        {sp.activated && <Notice tone="ok">Your account is active. Sign in with your new password.</Notice>}
        {sp.signedOut && <Notice tone="info">You have signed out.</Notice>}
        {sp.verified && <Notice tone="ok">Your email address has been verified.</Notice>}
      </div>
      <LoginForm next={sp.next ?? "/dashboard"} />
      <div className="mt-6 flex items-center justify-between font-sans text-sm">
        <Link href="/forgot-password">Forgot your password?</Link>
        <Link href="/sso" className="text-ink-muted">
          Corporate single sign-on{ssoConfigured ? "" : " (not configured)"}
        </Link>
      </div>
      {process.env.DEMO_MODE === "true" && (
        <details className="mt-10 rounded border border-line bg-surface px-4 py-3 font-sans text-[0.8125rem]">
          <summary className="cursor-pointer font-medium text-ink">Demonstration accounts (fictional)</summary>
          <p className="mt-2 text-ink-muted">All demo accounts use the password <code className="rounded bg-canvas px-1">Demo#Apex2026!</code></p>
          <ul className="mt-2 space-y-1 text-ink-muted">
            <li><b className="text-ink">Employee — new starter:</b> lina.saleh@apex-demo.test</li>
            <li><b className="text-ink">Employee — experienced:</b> james.okafor@apex-demo.test</li>
            <li><b className="text-ink">Employee — overdue training:</b> daniel.reyes@apex-demo.test</li>
            <li><b className="text-ink">Employee — on a learning path:</b> aisha.rahman@apex-demo.test</li>
            <li><b className="text-ink">Employee — pending CPD:</b> priya.natarajan@apex-demo.test</li>
            <li><b className="text-ink">Line manager:</b> omar.haddad@apex-demo.test</li>
            <li><b className="text-ink">Instructor:</b> graham.whitfield@apex-demo.test</li>
            <li><b className="text-ink">L&amp;D administrator:</b> helen.mercer@apex-demo.test</li>
            <li><b className="text-ink">Executive / HR:</b> catherine.lowe@apex-demo.test</li>
          </ul>
        </details>
      )}
      <p className="mt-8 font-sans text-[0.75rem] text-ink-faint">
        Need help? Contact <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a>
      </p>
    </div>
  );
}
