import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { catalogueFacets, searchCatalogue } from "@/server/services/catalogue";
import { EmptyState, LinkButton, PageHeader, Pagination, Status, Tag } from "@/components/ui";
import { DELIVERY, DIFFICULTY, ENROLLMENT, ENROLMENT_RULE } from "@/lib/status";
import { fmtHours, fmtNum } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("Course Catalogue") };
}

type SP = Record<string, string | undefined>;

export default async function CataloguePage({ searchParams }: { searchParams: Promise<SP> }) {
  const { t } = await getI18n();
  const actor = await requireActor();
  const sp = await searchParams;
  const [facets, result] = await Promise.all([catalogueFacets(), searchCatalogue(actor.id, { ...sp, page: Number(sp.page ?? 1) })]);
  const qs = (patch: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/catalogue?${p.toString()}`;
  };
  const active = Object.entries(sp).filter(([k, v]) => v && !["page", "sort"].includes(k));
  const filtersOn = active.filter(([k]) => k !== "q").length;
  const select = (name: string, label: string, options: [string, string][]) => (
    <div className="space-y-1">
      <label htmlFor={`f-${name}`} className="type-eyebrow block">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={sp[name] ?? ""} className="input-base h-9 !py-1">
        <option value="">{t("Any")}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow={t("Learning")} title={t("Course Catalogue")} description={t("Technical, safety, leadership and professional courses. Filter by competency, department or CPD eligibility to find learning relevant to your role.")} />
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label={t("Filters")}>
          <form action="/catalogue" className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="f-q" className="type-eyebrow block">{t("Search")}</label>
              <input id="f-q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder={t("Title, code or keyword")} className="input-base h-11 !rounded-full" />
            </div>
            {/* Phones: filters fold away behind one button; desktop opens them (see ClientEnhancements). */}
            <details className="group space-y-4 lg:space-y-0" data-desktop-open open={filtersOn > 0 || undefined}>
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-full bg-surface px-4 py-2.5 font-sans text-sm font-semibold text-ink shadow-panel lg:hidden [&::-webkit-details-marker]:hidden">
                <span>{t("Filters")}{filtersOn ? ` · ${t("{count} active", { count: filtersOn })}` : ""}</span>
                <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="space-y-4 pt-4 lg:pt-0">
            {select("category", t("Category"), facets.categories.filter((c) => c._count.courses > 0).map((c) => [c.slug, `${c.name} (${c._count.courses})`]))}
            {select("department", t("Department"), facets.departments.map((d) => [d.id, d.name]))}
            {select("competency", t("Competency"), facets.competencies.map((c) => [c.id, `${c.code} ${c.name}`]))}
            {select("difficulty", t("Level"), Object.entries(DIFFICULTY))}
            {select("duration", t("Duration"), [["lt2", t("Under 2 hours")], ["2-8", t("2–8 hours")], ["8-20", t("8–20 hours")], ["gt20", t("Over 20 hours")]])}
            {select("delivery", t("Delivery mode"), Object.entries(DELIVERY))}
            {select("mandatory", t("Requirement"), [["yes", t("Mandatory")], ["no", t("Optional")]])}
            {select("availability", t("Enrolment"), Object.entries(ENROLMENT_RULE))}
            <label className="flex items-center gap-2 font-sans text-sm">
              <input type="checkbox" name="cpd" value="yes" defaultChecked={sp.cpd === "yes"} className="h-4 w-4 accent-[rgb(22,38,68)]" /> {t("CPD-eligible only")}
            </label>
              </div>
            </details>
            <input type="hidden" name="sort" value={sp.sort ?? ""} />
            <div className="flex gap-2">
              <button type="submit" className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-navy px-4 font-sans text-sm font-semibold text-white hover:bg-navy-700">{t("Apply filters")}</button>
              {active.length > 0 && <LinkButton href="/catalogue" variant="secondary">{t("Clear")}</LinkButton>}
            </div>
          </form>
        </aside>

        <section aria-labelledby="results-h" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <h2 id="results-h" className="font-sans text-sm text-ink-muted" aria-live="polite">
              <span className="font-semibold text-ink">{result.total}</span> {t("{count, plural, one {course} other {courses}}", { count: result.total })}{sp.q ? <> {t("matching “{query}”", { query: sp.q })}</> : null}
            </h2>
            <nav aria-label={t("Sort")} className="flex items-center gap-1 font-sans text-[0.8125rem]">
              <span className="me-1 text-ink-faint">{t("Sort")}</span>
              {[["relevance", t("Relevance")], ["title", t("Title")], ["duration", t("Duration")], ["recent", t("Recently published")]].map(([k, l]) => (
                <Link key={k} href={qs({ sort: k, page: undefined })} aria-current={result.sort === k ? "true" : undefined} className={`rounded px-2 py-1 no-underline ${result.sort === k ? "bg-navy-50 font-medium text-navy" : "text-ink-muted hover:text-ink"}`}>
                  {l}
                </Link>
              ))}
            </nav>
          </div>
          {result.items.length === 0 ? (
            <EmptyState title={t("No courses match these filters")} action={<LinkButton href="/catalogue" variant="secondary" size="sm">{t("Clear filters")}</LinkButton>}>{t("Try broadening your search or removing a filter.")}</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-y border-line bg-surface">
              {result.items.map((c) => {
                const st = c.enrolmentStatus ? ENROLLMENT[c.enrolmentStatus] : null;
                return (
                  <li key={c.id} className="grid gap-x-6 gap-y-2 px-5 py-5 md:grid-cols-[minmax(0,1fr)_200px]">
                    <div className="min-w-0">
                      <p className="type-eyebrow">{c.category.name} · {c.code}</p>
                      <h3 className="mt-1 font-serif text-[1.125rem] font-semibold leading-snug">
                        <Link href={`/courses/${c.slug}`} className="text-navy no-underline hover:underline">{c.title}</Link>
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[0.9rem] text-ink-muted">{c.synopsis}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.isMandatory && <Status tone="crit" glyph={false}>{t("Mandatory")}</Status>}
                        <Tag>{DIFFICULTY[c.difficulty]}</Tag>
                        <Tag>{DELIVERY[c.deliveryMode]}</Tag>
                        {c.enrolmentRule !== "OPEN" && <Tag>{ENROLMENT_RULE[c.enrolmentRule]}</Tag>}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 self-start font-sans text-[0.8125rem] md:grid-cols-1">
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">{t("Study time")}</dt><dd className="tabular-nums">{fmtHours(c.estimatedHours.toString())}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">{t("CPD")}</dt><dd>{c.cpdEligible ? (c.cpdUnit === "POINTS" ? t("{n} pts", { n: fmtNum(c.cpdValue?.toString()) }) : t("{n} h", { n: fmtNum(c.cpdValue?.toString()) })) : t("Not eligible")}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">{t("Instructor")}</dt><dd className="truncate text-end">{c.instructors[0]?.user.name ?? c.provider}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">{t("Status")}</dt><dd>{st ? <Status tone={st[1]}>{st[0]}</Status> : <span className="text-ink-muted">{t("Not enrolled")}</span>}</dd></div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={result.page} pages={result.pages} hrefFor={(p) => qs({ page: String(p) })} />
        </section>
      </div>
    </div>
  );
}
