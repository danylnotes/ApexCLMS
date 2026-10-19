import clsx from "clsx";

/** Accessible horizontal bar list (pure HTML/CSS). Values are labelled directly; no colour-only encoding. */
export function BarList({ data, unit = "", max, tone = "navy", suffix }: { data: { label: string; value: number | null; note?: string }[]; unit?: string; max?: number; tone?: "navy" | "copper" | "slate"; suffix?: string }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  const bar = { navy: "bg-navy-700", copper: "bg-copper", slate: "bg-slate" }[tone];
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="font-sans text-[0.8125rem]">
          <div className="mb-1 flex justify-between gap-3">
            <span className="min-w-0 truncate text-ink">{d.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">{d.value == null ? "—" : `${Number.isInteger(d.value) ? d.value : d.value.toFixed(1)}${unit ? ` ${unit}` : ""}${suffix ?? ""}`}{d.note && <span className="text-ink-faint"> · {d.note}</span>}</span>
          </div>
          <div className="h-1.5 rounded-full bg-line" aria-hidden>
            <div className={clsx("h-full rounded-full", bar)} style={{ width: `${d.value == null ? 0 : Math.max(1, (d.value / m) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
