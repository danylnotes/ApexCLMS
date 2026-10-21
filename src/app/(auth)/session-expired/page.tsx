import { LinkButton } from "@/components/ui";
import { getSettings } from "@/server/settings";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Session expired") };
}

export default async function SessionExpired() {
  const { t } = await getI18n();
  const { security } = await getSettings();
  return (
    <div>
      <h2 className="font-sans text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("Your session has expired")}</h2>
      <p className="mt-2 text-ink-muted">
        {t("For the security of development records, sessions end after {minutes} minutes of inactivity or {hours} hours in total. Your learning progress is saved.", { minutes: security.sessionIdleMinutes, hours: security.sessionTtlHours })}
      </p>
      <div className="mt-6"><LinkButton href="/login">{t("Sign in again")}</LinkButton></div>
    </div>
  );
}
