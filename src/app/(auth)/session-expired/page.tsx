import { LinkButton } from "@/components/ui";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session expired" };

export default async function SessionExpired() {
  const { security } = await getSettings();
  return (
    <div>
      <h2 className="font-serif text-[1.625rem] font-semibold text-navy">Your session has expired</h2>
      <p className="mt-2 text-ink-muted">
        For the security of development records, sessions end after {security.sessionIdleMinutes} minutes of inactivity or {security.sessionTtlHours} hours in total. Your learning progress is saved.
      </p>
      <div className="mt-6"><LinkButton href="/login">Sign in again</LinkButton></div>
    </div>
  );
}
