import Link from "next/link";
import { redirect } from "next/navigation";
import { peekToken, verifyEmail } from "@/server/services/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Notice } from "@/components/ui";
import { resendVerificationAction } from "../actions";
import { SetPasswordForm } from "../reset-password/set-password-form";

export const metadata = { title: "Account verification" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (token) {
    const info = await peekToken(token, ["INVITATION", "EMAIL_VERIFICATION"]);
    if (info.valid && info.type === "INVITATION") {
      return (
        <div>
          <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Activate your account</h2>
          <p className="mt-1 text-ink-muted">Welcome, {info.name}. Choose a password for {info.email}.</p>
          <SetPasswordForm token={token} cta="Activate account" />
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
      <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Account verification</h2>
      {token && <div className="mt-4"><Notice tone="warn" title="Link invalid or expired">Request a new verification link below.</Notice></div>}
      <p className="mt-3 text-ink-muted">Enter your email address to receive a new verification link.</p>
      <ActionForm action={resendVerificationAction} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="block font-sans text-[0.8125rem] font-medium">Email address</label>
          <input id="email" name="email" type="email" required className="input-base" />
        </div>
        <SubmitButton className="w-full">Send verification link</SubmitButton>
      </ActionForm>
      <p className="mt-6 font-sans text-sm"><Link href="/login">Back to sign in</Link></p>
    </div>
  );
}
