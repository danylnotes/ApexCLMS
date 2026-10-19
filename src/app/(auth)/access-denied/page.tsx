import Link from "next/link";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Access denied" };

export default function AccessDenied() {
  return (
    <div>
      <p className="type-eyebrow">Error 403</p>
      <h2 className="mt-1 font-serif text-[1.625rem] font-semibold text-navy">You do not have access to this page</h2>
      <p className="mt-2 text-ink-muted">Your role does not include permission for this area. If you believe you need access, ask your line manager or the L&amp;D administrator to review your role assignment.</p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/dashboard">Go to dashboard</LinkButton>
        <LinkButton href="/help" variant="secondary">Help and support</LinkButton>
      </div>
      <p className="mt-6 font-sans text-sm"><Link href="/login">Sign in with a different account</Link></p>
    </div>
  );
}
