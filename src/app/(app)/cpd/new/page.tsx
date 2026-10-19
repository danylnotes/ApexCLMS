import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader, Notice } from "@/components/ui";
import { CPD_TYPE_LABEL } from "@/server/services/cpd";
import { ClaimForm } from "./claim-form";

export const metadata = { title: "Record CPD activity" };

export default async function NewClaim() {
  const actor = await requireActor();
  const [profile, competencies] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: actor.id }, include: { cpdPolicy: true } }),
    prisma.competency.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const p = profile?.cpdPolicy;
  const types = Object.entries(CPD_TYPE_LABEL).filter(([k]) => k !== "INTERNAL_COURSE" && k !== "WEBINAR" && (!p || !p.eligibleTypes.length || p.eligibleTypes.includes(k as never)));
  return (
    <div className="max-w-3xl">
      <PageHeader crumbs={[{ label: "My CPD", href: "/cpd" }, { label: "Record activity" }]} eyebrow="Development" title="Record a CPD activity" description="Internal courses and verified webinars are recorded automatically. Use this form for external and other professional development." />
      {p && <div className="mb-6"><Notice tone="info" title={p.name}>Unit: {p.unit === "POINTS" ? `points (${p.pointsPerHour ?? 1} per hour)` : "hours"}{p.maxPerActivity ? ` · maximum ${p.maxPerActivity} per activity` : ""}{p.targetPerPeriod ? ` · target ${p.targetPerPeriod} per period` : " · record only"}.</Notice></div>}
      <ClaimForm types={types} competencies={competencies} unit={p?.unit ?? "HOURS"} pointsPerHour={p?.pointsPerHour ? Number(p.pointsPerHour) : 1} max={p?.maxPerActivity ? Number(p.maxPerActivity) : null} />
    </div>
  );
}
