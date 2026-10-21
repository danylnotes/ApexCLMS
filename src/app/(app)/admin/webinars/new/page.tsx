import { requirePagePermission } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { WebinarForm } from "../webinar-form";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Schedule webinar") };
}

export default async function NewWebinar() {
  await requirePagePermission("webinar.manage");
  const { t } = await getI18n();
  return (
    <div>
      <PageHeader crumbs={[{ label: t("Webinars"), href: "/admin/webinars" }, { label: t("New") }]} eyebrow={t("Administration")} title={t("Schedule a webinar")} />
      <Panel><WebinarForm /></Panel>
    </div>
  );
}
