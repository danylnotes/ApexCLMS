import Link from "next/link";
import type { CompetencyRow } from "@/server/services/competency";
import { METHOD_LABEL } from "@/server/services/competency";
import { COMPETENCY } from "@/lib/status";
import { fmtDate } from "@/lib/format";
import { Status, Table, Td, Th } from "./ui";

function Levels({ value, required, max = 5 }: { value: number; required: number | null; max?: number }) {
  return (
    <span className="inline-flex gap-[3px] align-middle" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-[2px] border ${i < value ? "border-navy-700 bg-navy-700" : required != null && i < required ? "border-warn bg-warn-50" : "border-line-strong bg-surface"}`} />
      ))}
    </span>
  );
}

/** Competency matrix: requirement vs. current evidence, with gap, evidence and recommended learning. */
export function CompetencyTable({ rows, showRecommended = true }: { rows: CompetencyRow[]; showRecommended?: boolean }) {
  return (
    <Table caption="Competency requirements and current assessments">
      <thead>
        <tr><Th>Competency</Th><Th>Required</Th><Th>Current</Th><Th>Evidence</Th><Th>Assessed</Th><Th>Status</Th>{showRecommended && <Th>Recommended learning</Th>}</tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const ev = r.evaluation!;
          const [label, tone] = COMPETENCY[ev.status];
          const lvl = (n: number | null) => (n == null ? "—" : `${n} · ${r.levelNames[n] ?? ""}`);
          return (
            <tr key={r.competency.id}>
              <Td className="min-w-[200px]">
                <span className="font-medium">{r.competency.name}</span>{r.isCritical && <span className="ml-1.5 type-meta">(critical)</span>}
                <div className="type-meta">{r.competency.code} · {r.competency.domain}</div>
              </Td>
              <Td className="whitespace-nowrap">{lvl(r.requiredLevel)}</Td>
              <Td className="whitespace-nowrap">
                <Levels value={ev.effectiveLevel} required={r.requiredLevel} />
                <span className="ml-2 sr-only">Effective level {ev.effectiveLevel} of required {r.requiredLevel}.</span>
                <div className="type-meta">{r.current ? lvl(r.current.level) : "Not assessed"}</div>
              </Td>
              <Td className="min-w-[180px]">
                {r.current ? (
                  <>
                    <span>{METHOD_LABEL[r.current.method]}</span>
                    <div className="type-meta">{r.current.basis === "DEMONSTRATED" ? "Demonstrated competence" : ev.knowledgeOnly ? "Knowledge only — demonstration required" : "Knowledge (accepted by framework)"}</div>
                    {r.current.evidence[0] && <div className="type-meta">{r.current.evidence[0].description}{r.current.evidence[0].fileId && <> · <a href={`/api/v1/files/${r.current.evidence[0].fileId}`}>file</a></>}</div>}
                  </>
                ) : "—"}
              </Td>
              <Td className="whitespace-nowrap">
                {r.current ? fmtDate(r.current.assessedAt) : "—"}
                {r.current?.assessor && <div className="type-meta">{r.current.assessor}</div>}
                {r.current?.reassessmentDue && <div className={`type-meta ${ev.status === "EXPIRED" ? "!text-crit" : ""}`}>Reassess {fmtDate(r.current.reassessmentDue)}</div>}
              </Td>
              <Td><Status tone={tone}>{label}</Status>{ev.gap > 0 && <div className="mt-1 type-meta">{ev.gap} level{ev.gap > 1 ? "s" : ""} to develop</div>}</Td>
              {showRecommended && (
                <Td className="min-w-[160px]">{r.recommended.length ? r.recommended.map((c) => <div key={c.slug}><Link href={`/courses/${c.slug}`}>{c.code}</Link> <span className="type-meta">{c.title}</span></div>) : <span className="type-meta">{ev.status === "MET" ? "—" : ev.knowledgeOnly || ev.status === "NOT_ASSESSED" ? "Workplace assessment" : "Discuss with manager"}</span>}</Td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
