import clsx from "clsx";
import { activeIntl, tr } from "@/i18n/active";
import type { ReactNode } from "react";

/* Dashboard widgets: rings, bars and a month calendar. Server-rendered, no client JavaScript. */

export function ProgressRing({ value, size = 48, stroke = 5, label, tone = "dark", children }: { value: number; size?: number; stroke?: number; label: string; tone?: "dark" | "lime" | "light"; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const track = tone === "light" ? "rgb(255 255 255 / 0.15)" : "rgb(var(--canvas))";
  const bar = tone === "dark" ? "rgb(var(--navy))" : "rgb(var(--lime))";
  return (
    <span role="img" aria-label={`${label}: ${v}%`} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bar} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className={clsx("absolute font-sans font-bold tabular-nums", size >= 80 ? "text-lg" : "text-[0.75rem]", tone === "light" ? "text-white" : "text-ink")} aria-hidden>
        {children ?? `${v}%`}
      </span>
    </span>
  );
}

/** Vertical bars; the highlighted bar is filled lime and carries a value label (as a tooltip would). */
export function BarChart({ data, highlight, unit, height = 160 }: { data: { label: string; value: number; full: string }[]; highlight: number; unit: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [max, max / 2, 0];
  return (
    <figure>
      <div className="flex gap-3">
        <div className="flex flex-col justify-between pb-6 text-end font-sans text-[0.75rem] tabular-nums text-ink-faint" style={{ height }} aria-hidden>
          {ticks.map((t, i) => <span key={i}>{t >= 10 ? Math.round(t) : Math.round(t * 10) / 10}{unit}</span>)}
        </div>
        <ul className="flex min-w-0 flex-1 items-end justify-between gap-1 sm:gap-2" style={{ height }}>
          {data.map((d, i) => {
            const on = i === highlight;
            return (
              <li key={d.full} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                {on && <span className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-navy px-2 py-1 font-sans text-[0.75rem] font-semibold text-white shadow-pop">{d.value.toFixed(1)}{unit}</span>}
                <span
                  className={clsx("w-full max-w-[34px] rounded-full", on ? "bg-lime" : "bg-canvas")}
                  style={{ height: `calc(${(d.value / max) * 100}% - 24px)`, minHeight: 8 }}
                  title={`${d.full}: ${d.value.toFixed(1)}${unit}`}
                />
                <span className={clsx("max-w-full truncate font-sans text-[0.6875rem] sm:text-[0.75rem]", on ? "font-semibold text-ink" : "text-ink-faint")}>{d.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.full}: ${d.value.toFixed(1)}${unit}`).join("; ")}
      </figcaption>
    </figure>
  );
}

/** Narrow weekday names, Monday first, in the current language. */
function weekdayInitials() {
  const f = new Intl.DateTimeFormat(activeIntl(), { weekday: "narrow", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

/** Month grid with today highlighted and dots on days that have events. */
export function MiniCalendar({ today, events }: { today: Date; events: { date: Date; tone: "crit" | "warn" | "info" }[] }) {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const byDay = new Map<number, Set<string>>();
  for (const e of events) {
    if (e.date.getUTCFullYear() !== y || e.date.getUTCMonth() !== m) continue;
    const d = e.date.getUTCDate();
    if (!byDay.has(d)) byDay.set(d, new Set());
    byDay.get(d)!.add(e.tone);
  }
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const dot = { crit: "bg-crit", warn: "bg-warn", info: "bg-info" } as const;
  return (
    <div>
      <p className="mb-3 font-sans text-sm font-bold text-ink">{first.toLocaleDateString(activeIntl(), { month: "long", year: "numeric", timeZone: "UTC" })}</p>
      <div className="grid grid-cols-7 gap-y-1 text-center font-sans text-[0.75rem]" role="grid" aria-label={tr("This month")}>
        {weekdayInitials().map((d, i) => <span key={i} className="pb-1 font-semibold text-ink-faint" aria-hidden>{d}</span>)}
        {cells.map((d, i) => {
          const isToday = d === today.getUTCDate();
          const marks = d ? byDay.get(d) : undefined;
          return (
            <span key={i} className="flex flex-col items-center gap-0.5" role="gridcell" aria-label={d ? [String(d), isToday && tr("today"), marks && tr("has activity")].filter(Boolean).join(", ") : undefined}>
              <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full tabular-nums", isToday ? "bg-navy font-bold text-lime" : d ? "text-ink" : "")}>{d ?? ""}</span>
              <span className="flex h-1 gap-0.5" aria-hidden>{marks && [...marks].map((t) => <span key={t} className={clsx("h-1 w-1 rounded-full", dot[t as keyof typeof dot])} />)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const CHIP = ["chip-lavender", "chip-peach", "chip-mint", "chip-sky"] as const;
export const chipClass = (i: number) => CHIP[i % CHIP.length];

/** A metric card with a pastel icon chip and an optional definition. */
export function StatCard({ icon, label, value, context, definition, tone, chip = 0 }: { icon: ReactNode; label: string; value: ReactNode; context?: ReactNode; definition?: string; tone?: "crit" | "warn"; chip?: number }) {
  return (
    <div className="card flex min-w-0 flex-col p-4 shadow-panel">
      <div className="flex items-start justify-between gap-2">
        <span className={clsx("flex h-10 w-10 items-center justify-center rounded-2xl text-navy", chipClass(chip))} aria-hidden>{icon}</span>
        {tone && <span className={clsx("rounded-full px-2 py-0.5 font-sans text-[0.75rem] font-semibold", tone === "crit" ? "bg-crit-50 text-crit" : "bg-warn-50 text-warn")}>{tone === "crit" ? tr("Action") : tr("Attention")}</span>}
      </div>
      <dt className="mt-3 font-sans text-[0.75rem] font-medium text-ink-muted">{label}</dt>
      <dd className="mt-0.5">
        <span className="type-figure !font-extrabold">{value}</span>
        {context && <span className="mt-1 block font-sans text-[0.75rem] text-ink-faint">{context}</span>}
      </dd>
      {definition && (
        <details className="mt-auto pt-2">
          <summary className="cursor-pointer list-none font-sans text-[0.75rem] text-ink-faint hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-dotted underline-offset-2">{tr("How is this calculated?")}</span>
          </summary>
          <p className="mt-1 text-[0.75rem] leading-snug text-ink-muted">{definition}</p>
        </details>
      )}
    </div>
  );
}
