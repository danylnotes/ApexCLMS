import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { catalogueFacets, searchCatalogue } from "@/server/services/catalogue";
import { EmptyState, LinkButton, PageHeader, Pagination, Status, Tag } from "@/components/ui";
import { DELIVERY, DIFFICULTY, ENROLLMENT, ENROLMENT_RULE } from "@/lib/status";
import { fmtHours, fmtNum } from "@/lib/format";

export const metadata = { title: "Course Catalogue" };

type SP = Record<string, string | undefined>;

export default async function CataloguePage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const [facets, result] = await Promise.all([catalogueFacets(), searchCatalogue(actor.id, { ...sp, page: Number(sp.page ?? 1) })]);
  const qs = (patch: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/catalogue?${p.toString()}`;
  };
  const active = Object.entries(sp).filter(([k, v]) => v && !["page", "sort"].includes(k));
  const select = (name: string, label: string, options: [string, string][]) => (
    <div className="space-y-1">
      <label htmlFor={`f-${name}`} className="type-eyebrow block">{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={sp[name] ?? ""} className="input-base h-9 !py-1">
        <option value="">Any</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Learning" title="Course Catalogue" description="Technical, safety, leadership and professional courses. Filter by competency, department or CPD eligibility to find learning relevant to your role." />
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="Filters">
          <form action="/catalogue" className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="f-q" className="type-eyebrow block">Search</label>
              <input id="f-q" name="q" type="search" defaultValue={sp.q ?? ""} placeholder="Title, code or keyword" className="input-base h-9" />
            </div>
            {select("category", "Category", facets.categories.filter((c) => c._count.courses > 0).map((c) => [c.slug, `${c.name} (${c._count.courses})`]))}
            {select("department", "Department", facets.departments.map((d) => [d.id, d.name]))}
            {select("competency", "Competency", facets.competencies.map((c) => [c.id, `${c.code} ${c.name}`]))}
            {select("difficulty", "Level", Object.entries(DIFFICULTY))}
            {select("duration", "Duration", [["lt2", "Under 2 hours"], ["2-8", "2–8 hours"], ["8-20", "8–20 hours"], ["gt20", "Over 20 hours"]])}
            {select("delivery", "Delivery mode", Object.entries(DELIVERY))}
            {select("mandatory", "Requirement", [["yes", "Mandatory"], ["no", "Optional"]])}
            {select("availability", "Enrolment", Object.entries(ENROLMENT_RULE))}
            <label className="flex items-center gap-2 font-sans text-sm">
              <input type="checkbox" name="cpd" value="yes" defaultChecked={sp.cpd === "yes"} className="h-4 w-4 accent-[rgb(22,38,68)]" /> CPD-eligible only
            </label>
            <input type="hidden" name="sort" value={sp.sort ?? ""} />
            <div className="flex gap-2">
              <button type="submit" className="inline-flex h-9 flex-1 items-center justify-center rounded bg-navy px-3 font-sans text-sm font-medium text-white hover:bg-navy-700">Apply filters</button>
              {active.length > 0 && <LinkButton href="/catalogue" variant="secondary">Clear</LinkButton>}
            </div>
          </form>
        </aside>

        <section aria-labelledby="results-h" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <h2 id="results-h" className="font-sans text-sm text-ink-muted" aria-live="polite">
              <span className="font-semibold text-ink">{result.total}</span> course{result.total === 1 ? "" : "s"}{sp.q ? <> matching “{sp.q}”</> : null}
            </h2>
            <nav aria-label="Sort" className="flex items-center gap-1 font-sans text-[0.8125rem]">
              <span className="mr-1 text-ink-faint">Sort</span>
              {[["relevance", "Relevance"], ["title", "Title"], ["duration", "Duration"], ["recent", "Recently published"]].map(([k, l]) => (
                <Link key={k} href={qs({ sort: k, page: undefined })} aria-current={result.sort === k ? "true" : undefined} className={`rounded px-2 py-1 no-underline ${result.sort === k ? "bg-navy-50 font-medium text-navy" : "text-ink-muted hover:text-ink"}`}>
                  {l}
                </Link>
              ))}
            </nav>
          </div>
          {result.items.length === 0 ? (
            <EmptyState title="No courses match these filters" action={<LinkButton href="/catalogue" variant="secondary" size="sm">Clear filters</LinkButton>}>Try broadening your search or removing a filter.</EmptyState>
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
                        {c.isMandatory && <Status tone="crit" glyph={false}>Mandatory</Status>}
                        <Tag>{DIFFICULTY[c.difficulty]}</Tag>
                        <Tag>{DELIVERY[c.deliveryMode]}</Tag>
                        {c.enrolmentRule !== "OPEN" && <Tag>{ENROLMENT_RULE[c.enrolmentRule]}</Tag>}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 self-start font-sans text-[0.8125rem] md:grid-cols-1">
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">Study time</dt><dd className="tabular-nums">{fmtHours(c.estimatedHours.toString())}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">CPD</dt><dd>{c.cpdEligible ? `${fmtNum(c.cpdValue?.toString())} ${c.cpdUnit === "POINTS" ? "pts" : "h"}` : "Not eligible"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">Instructor</dt><dd className="truncate text-right">{c.instructors[0]?.user.name ?? c.provider}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-ink-faint">Status</dt><dd>{st ? <Status tone={st[1]}>{st[0]}</Status> : <span className="text-ink-muted">Not enrolled</span>}</dd></div>
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
