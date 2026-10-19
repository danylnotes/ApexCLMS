import { requirePagePermission } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/ui";
import { WebinarForm } from "../webinar-form";

export const metadata = { title: "Schedule webinar" };

export default async function NewWebinar() {
  await requirePagePermission("webinar.manage");
  return (
    <div>
      <PageHeader crumbs={[{ label: "Webinars", href: "/admin/webinars" }, { label: "New" }]} eyebrow="Administration" title="Schedule a webinar" />
      <Panel><WebinarForm /></Panel>
    </div>
  );
}
