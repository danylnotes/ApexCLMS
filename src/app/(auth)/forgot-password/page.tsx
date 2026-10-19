import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Reset your password</h2>
      <p className="mt-1 text-ink-muted">Enter your corporate email address. If an active account exists, we will send a single-use reset link.</p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="block font-sans text-[0.8125rem] font-medium">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="input-base" />
        </div>
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 font-sans text-sm"><Link href="/login">Back to sign in</Link></p>
    </div>
  );
}
