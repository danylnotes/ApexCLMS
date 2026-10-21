import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate, fmtRelative } from "@/lib/format";
import { markAllReadAction, openNotification } from "../learner-actions";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Notifications") };
}

export default async function NotificationsPage() {
  const { t } = await getI18n();
  const actor = await requireActor();
  const items = await prisma.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow={t("Account")} title={t("Notifications")} description={t("{count} unread", { count: unread })} actions={<>{unread > 0 && <ActionForm action={markAllReadAction} inline><SubmitButton variant="secondary">{t("Mark all as read")}</SubmitButton></ActionForm>}<LinkButton href="/profile#notifications" variant="ghost">{t("Preferences")}</LinkButton></>} />
      {items.length === 0 ? <EmptyState title={t("No notifications")} /> : (
        <ul className="divide-y divide-line rounded-[22px] bg-surface">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className="flex w-full gap-3 px-5 py-4 text-start hover:bg-canvas">
                  <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-copper"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-sans text-sm ${n.readAt ? "text-ink" : "font-semibold text-ink"}`}>{n.title}{!n.readAt && <span className="sr-only"> {t("(unread)")}</span>}</span>
                    <span className="block text-[0.875rem] text-ink-muted">{n.body}</span>
                    <span className="mt-0.5 block type-meta" title={fmtDate(n.createdAt)}>{fmtRelative(n.createdAt)}{n.emailStatus === "SENT" ? ` · ${t("also emailed")}` : ""}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
