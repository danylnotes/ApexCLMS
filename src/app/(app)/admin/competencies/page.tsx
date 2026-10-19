import { requirePagePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Field, PageHeader, Panel, TabNav } from "@/components/ui";
import { frameworkAction, roleRequirementsAction } from "../../staff-actions";

export const metadata = { title: "Competency Framework Management" };

export default async function CompetencyAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; role?: string }> }) {
  await requirePagePermission("competency.manage");
  const { tab = "framework", role } = await searchParams;
  const fw = await prisma.competencyFramework.findFirst({ orderBy: { status: "asc" }, include: { levels: { orderBy: { level: "asc" } }, domains: { orderBy: { sortOrder: "asc" }, include: { competencies: { orderBy: { code: "asc" } } } } } });
  if (!fw) return <EmptyState title="No competency framework configured" />;
  const roles = await prisma.jobRole.findMany({ orderBy: { title: "asc" }, include: { requirements: true } });
  const selected = roles.find((r) => r.id === role) ?? roles[0];
  return (
    <div>
      <PageHeader eyebrow="Administration" title="Competency Framework Management" description="Configure the framework, proficiency levels, competencies and the requirements of each job role." />
      <TabNav current={tab} tabs={[{ key: "framework", label: "Framework and levels", href: "/admin/competencies" }, { key: "competencies", label: "Domains and competencies", href: "/admin/competencies?tab=competencies" }, { key: "roles", label: "Role requirements", href: "/admin/competencies?tab=roles" }]} />
      {tab === "framework" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <Panel title="Framework">
            <ActionForm action={frameworkAction} className="space-y-3">
              <input type="hidden" name="frameworkId" value={fw.id} /><input type="hidden" name="op" value="framework" />
              <Field label="Name" htmlFor="name"><input id="name" name="name" defaultValue={fw.name} className="input-base" /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Version" htmlFor="version"><input id="version" name="version" defaultValue={fw.version} className="input-base" /></Field><Field label="Status" htmlFor="status"><select id="status" name="status" defaultValue={fw.status} className="input-base"><option>DRAFT</option><option>ACTIVE</option><option>RETIRED</option></select></Field></div>
              <Field label="Description" htmlFor="description"><textarea id="description" name="description" rows={3} defaultValue={fw.description ?? ""} className="input-base" /></Field>
              <label className="flex items-start gap-2 text-[0.875rem]"><input type="checkbox" name="allowCourse" defaultChecked={fw.allowCourseCompletionAsCompetence} className="mt-1 h-4 w-4 accent-[rgb(22,38,68)]" /><span>Accept course completion as evidence of competence<span className="block type-meta">When off (recommended for operational roles), course completion is recorded as knowledge only and workplace demonstration is required.</span></span></label>
              <SubmitButton size="sm">Save framework</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title="Proficiency levels">
            <div className="space-y-3">
              {[...fw.levels, { id: "new", level: fw.levels.length + 1, name: "", description: "" }].map((l) => (
                <ActionForm key={l.id} action={frameworkAction} className="grid grid-cols-[60px_1fr] gap-2 border-b border-line pb-3 last:border-0">
                  <input type="hidden" name="frameworkId" value={fw.id} /><input type="hidden" name="op" value="level" />
                  <input name="level" type="number" min={1} max={10} defaultValue={l.level} aria-label="Level" className="input-base" />
                  <input name="name" defaultValue={l.name} placeholder={l.id === "new" ? "Add a level" : ""} aria-label="Level name" className="input-base" />
                  <textarea name="description" rows={2} defaultValue={l.description} aria-label="Level description" className="input-base col-span-2" />
                  <div className="col-span-2"><SubmitButton size="sm" variant="secondary">{l.id === "new" ? "Add level" : "Save"}</SubmitButton></div>
                </ActionForm>
              ))}
            </div>
          </Panel>
        </div>
      )}
      {tab === "competencies" && (
        <div className="space-y-6">
          {fw.domains.map((d) => (
            <Panel key={d.id} title={d.name} description={`${d.competencies.length} competencies`} bodyClassName="p-0">
              {d.competencies.map((c) => (
                <details key={c.id} className="border-b border-line px-5 py-3 last:border-0">
                  <summary className="cursor-pointer text-[0.875rem]"><span className="font-sans text-[0.75rem] text-ink-faint">{c.code}</span> <span className="font-medium">{c.name}</span>{c.reassessmentMonths && <span className="type-meta"> · reassess every {c.reassessmentMonths} months</span>}{!c.isActive && <span className="type-meta"> · inactive</span>}</summary>
                  <CompetencyForm fwId={fw.id} domainId={d.id} c={c} />
                </details>
              ))}
              <details className="bg-canvas/50 px-5 py-3"><summary className="cursor-pointer font-sans text-sm font-medium text-navy-700">Add competency to {d.name}</summary><CompetencyForm fwId={fw.id} domainId={d.id} /></details>
            </Panel>
          ))}
          <Panel title="Add domain"><ActionForm action={frameworkAction} className="flex gap-2" resetOnSuccess><input type="hidden" name="frameworkId" value={fw.id} /><input type="hidden" name="op" value="domain" /><input name="name" aria-label="Domain name" required className="input-base" /><SubmitButton size="sm">Add</SubmitButton></ActionForm></Panel>
        </div>
      )}
      {tab === "roles" && selected && (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Job roles" className="space-y-0.5">{roles.map((r) => <a key={r.id} href={`/admin/competencies?tab=roles&role=${r.id}`} aria-current={r.id === selected.id ? "page" : undefined} className={`block rounded px-3 py-1.5 font-sans text-[0.8125rem] no-underline ${r.id === selected.id ? "bg-navy-50 font-medium text-navy" : "text-ink hover:bg-canvas"}`}>{r.title} <span className="text-ink-faint">({r.requirements.length})</span></a>)}</nav>
          <Panel title={`Requirements — ${selected.title}`} description="Set the required proficiency level (0 = not required). Critical requirements are highlighted in profiles.">
            <ActionForm action={roleRequirementsAction}>
              <input type="hidden" name="jobRoleId" value={selected.id} />
              <table className="w-full font-sans text-[0.8125rem]">
                <thead><tr className="border-b border-line text-left text-ink-faint"><th className="py-2 font-medium">Competency</th><th className="w-28 font-medium">Required level</th><th className="w-20 text-center font-medium">Critical</th></tr></thead>
                <tbody>
                  {fw.domains.flatMap((d) => d.competencies.filter((c) => c.isActive).map((c) => {
                    const req = selected.requirements.find((r) => r.competencyId === c.id);
                    return (
                      <tr key={c.id} className="border-b border-line">
                        <td className="py-1.5"><input type="hidden" name="competencyIds" value={c.id} /><span className="text-ink-faint">{c.code}</span> {c.name} <span className="text-ink-faint">· {d.name}</span></td>
                        <td><select name={`req_${c.id}`} defaultValue={req?.requiredLevel ?? 0} aria-label={`Required level for ${c.name}`} className="input-base h-8 !py-0"><option value={0}>—</option>{fw.levels.map((l) => <option key={l.level} value={l.level}>{l.level} {l.name}</option>)}</select></td>
                        <td className="text-center"><input type="checkbox" name={`crit_${c.id}`} defaultChecked={req?.isCritical} aria-label={`${c.name} critical`} className="h-4 w-4 accent-[rgb(22,38,68)]" /></td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
              <div className="mt-4"><SubmitButton>Save requirements</SubmitButton></div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </div>
  );
}

function CompetencyForm({ fwId, domainId, c }: { fwId: string; domainId: string; c?: { id: string; code: string; name: string; description: string; evidenceRequirements: string | null; assessmentCriteria: string | null; reassessmentMonths: number | null; isActive: boolean } }) {
  const u = c?.id ?? `new-${domainId}`;
  return (
    <ActionForm action={frameworkAction} className="mt-3 grid gap-3 md:grid-cols-4" resetOnSuccess={!c}>
      <input type="hidden" name="frameworkId" value={fwId} /><input type="hidden" name="op" value="competency" /><input type="hidden" name="domainId" value={domainId} />{c && <input type="hidden" name="competencyId" value={c.id} />}
      <Field label="Code" htmlFor={`cc-${u}`}><input id={`cc-${u}`} name="code" defaultValue={c?.code} required className="input-base uppercase" /></Field>
      <div className="md:col-span-2"><Field label="Name" htmlFor={`cn-${u}`}><input id={`cn-${u}`} name="name" defaultValue={c?.name} required className="input-base" /></Field></div>
      <Field label="Reassess (months)" htmlFor={`cr-${u}`}><input id={`cr-${u}`} name="reassessmentMonths" type="number" min={1} defaultValue={c?.reassessmentMonths ?? ""} className="input-base" /></Field>
      <div className="md:col-span-4"><Field label="Description" htmlFor={`cd-${u}`}><textarea id={`cd-${u}`} name="description" rows={2} defaultValue={c?.description} required className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label="Evidence requirements" htmlFor={`ce-${u}`}><textarea id={`ce-${u}`} name="evidenceRequirements" rows={2} defaultValue={c?.evidenceRequirements ?? ""} className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label="Assessment criteria" htmlFor={`ca-${u}`}><textarea id={`ca-${u}`} name="assessmentCriteria" rows={2} defaultValue={c?.assessmentCriteria ?? ""} className="input-base" /></Field></div>
      {c && <label className="flex items-center gap-2 font-sans text-sm"><input type="checkbox" name="inactive" defaultChecked={!c.isActive} className="h-4 w-4 accent-[rgb(22,38,68)]" />Inactive</label>}
      <div><SubmitButton size="sm">{c ? "Save" : "Add competency"}</SubmitButton></div>
    </ActionForm>
  );
}
