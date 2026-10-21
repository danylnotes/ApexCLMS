import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="type-eyebrow">{t("Error 404")}</p>
      <h1 className="type-display mt-1">{t("Page not found")}</h1>
      <p className="mt-2 text-ink-muted">{t("The page does not exist, or you do not have access to the record you requested.")}</p>
      <p className="mt-6 font-sans text-sm"><Link href="/dashboard">{t("Return to your dashboard")}</Link></p>
    </main>
  );
}
