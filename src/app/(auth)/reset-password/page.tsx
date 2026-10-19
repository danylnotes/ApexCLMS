import Link from "next/link";
import { peekToken } from "@/server/services/auth";
import { Notice } from "@/components/ui";
import { SetPasswordForm } from "./set-password-form";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const info = token ? await peekToken(token, ["PASSWORD_RESET"]) : { valid: false as const };
  return (
    <div>
      <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Set a new password</h2>
      {!info.valid ? (
        <div className="mt-6 space-y-4">
          <Notice tone="warn" title="Link invalid or expired">Reset links are valid for 60 minutes and can be used once.</Notice>
          <p className="font-sans text-sm"><Link href="/forgot-password">Request a new link</Link></p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-ink-muted">For {info.email}. Signing in again will be required on all devices.</p>
          <SetPasswordForm token={token!} />
        </>
      )}
    </div>
  );
}
