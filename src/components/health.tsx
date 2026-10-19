import Link from "next/link";
import type { HealthDimension } from "@/lib/domain/health";
import { HEALTH_STATUS_LABEL } from "@/lib/domain/health";
import { HEALTH_TONE } from "@/lib/status";
import { fmtDate } from "@/lib/format";
import { Status } from "./ui";

/** Career Development Health: five rule-based dimensions, each with evidence, gaps, next step and its method. */
export function HealthTable({ dimensions, computedAt, detailed = false }: { dimensions: HealthDimension[]; computedAt: Date; detailed?: boolean }) {
  return (
    <div>
      <ol className="divide-y divide-line">
        {dimensions.map((d, i) => (
          <li key={d.key} className="grid gap-x-6 gap-y-2 py-4 first:pt-1 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,200px)]">
            <div>
              <p className="font-sans text-[0.75rem] tabular-nums text-ink-faint">{String.fromCharCode(65 + i)}</p>
              <h3 className="font-sans text-sm font-semibold text-ink">{d.title}</h3>
              <div className="mt-1.5">
                <Status tone={HEALTH_TONE[d.status]}>{HEALTH_STATUS_LABEL[d.status]}</Status>
              </div>
              {detailed && <p className="mt-2 type-meta">Last review: {d.lastReviewed ? fmtDate(d.lastReviewed) : "—"}</p>}
            </div>
            <div className="min-w-0 text-[0.875rem]">
              <ul className="space-y-0.5 text-ink">
                {d.evidence.map((e, j) => (
                  <li key={j} className="flex gap-2"><span aria-hidden className="text-ink-faint">–</span>{e}</li>
                ))}
              </ul>
              {d.gaps.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-ink-muted">
                  {d.gaps.map((g, j) => (
                    <li key={j} className="flex gap-2"><span aria-hidden className="text-warn">▲</span><span><span className="sr-only">Gap: </span>{g}</span></li>
                  ))}
                </ul>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer font-sans text-[0.75rem] text-ink-faint hover:text-navy-700">How this status is derived</summary>
                <p className="mt-1 max-w-2xl text-[0.8125rem] leading-snug text-ink-muted">{d.method}</p>
              </details>
            </div>
            <div className="md:text-right">
              {d.nextAction && (
                <>
                  <p className="type-eyebrow md:text-right">Recommended next step</p>
                  <Link href={d.nextAction.href} className="mt-0.5 inline-block font-sans text-sm font-medium">{d.nextAction.label} →</Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-line pt-3 type-meta">
        Calculated {fmtDate(computedAt)} from your current records using the rules configured by Learning &amp; Development. There is no composite score: each dimension stands on its own evidence. These indicators support development conversations and are not used for automated employment decisions.
      </p>
    </div>
  );
}
