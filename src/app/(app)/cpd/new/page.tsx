import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader, Notice } from "@/components/ui";
import { CPD_TYPE_LABEL } from "@/server/services/cpd";
import { ClaimForm } from "./claim-form";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Record CPD activity") };
}

export default async function NewClaim() {
  const { t } = await getI18n();
  const actor = await requireActor();
  const [profile, competencies] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: actor.id }, include: { cpdPolicy: true } }),
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const p = profile?.cpdPolicy;
  const types = Object.entries(CPD_TYPE_LABEL).filter(([k]) => k !== "INTERNAL_COURSE" && k !== "WEBINAR" && (!p || !p.eligibleTypes.length || p.eligibleTypes.includes(k as never)));
  return (
    <div className="max-w-3xl">
      <PageHeader crumbs={[{ label: t("My CPD"), href: "/cpd" }, { label: t("Record activity") }]} eyebrow={t("Development")} title={t("Record a CPD activity")} description={t("Internal courses and verified webinars are recorded automatically. Use this form for external and other professional development.")} />
      {p && <div className="mb-6"><Notice tone="info" title={p.name}>{t("Unit: {unit}", { unit: p.unit === "POINTS" ? t("points ({rate} per hour)", { rate: String(p.pointsPerHour ?? 1) }) : t("hours") })}{p.maxPerActivity ? ` · ${t("maximum {value} per activity", { value: String(p.maxPerActivity) })}` : ""}{p.targetPerPeriod ? ` · ${t("target {value} per period", { value: String(p.targetPerPeriod) })}` : ` · ${t("record only")}`}.</Notice></div>}
      <ClaimForm types={types} competencies={competencies} unit={p?.unit ?? "HOURS"} pointsPerHour={p?.pointsPerHour ? Number(p.pointsPerHour) : 1} max={p?.maxPerActivity ? Number(p.maxPerActivity) : null} />
    </div>
  );
}
