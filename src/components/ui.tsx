import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/* ───────── Typography & structure ───────── */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  crumbs,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  meta?: ReactNode;
}) {
  return (
    <header className="mb-7">
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="type-eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="type-display">{title}</h1>
          {description && <div className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-muted">{description}</div>}
          {meta && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 type-meta">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 no-print">{actions}</div>}
      </div>
    </header>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 no-print">
      <ol className="flex flex-wrap items-center gap-1 type-meta">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden />}
            {c.href ? (
              <Link href={c.href} className="text-ink-muted no-underline hover:text-navy hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
  as: As = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <As id={id} className={clsx("card shadow-panel print-plain", className)} aria-labelledby={title && id ? `${id}-h` : undefined}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-6 pb-1 pt-5">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={id ? `${id}-h` : undefined} className="type-section">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 type-meta">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={clsx("px-6 py-4", bodyClassName)}>{children}</div>
    </As>
  );
}

export function SectionHeading({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="type-title">
        {children}
      </h2>
      {aside && <div className="type-meta">{aside}</div>}
    </div>
  );
}

/* ───────── Actions ───────── */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-700 border border-navy",
  accent: "bg-lime text-navy hover:bg-lime-600 border border-lime",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink-faint hover:bg-canvas",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-canvas",
  danger: "bg-surface text-crit border border-crit/40 hover:bg-crit-50",
};
const sizes = { sm: "h-8 px-3.5 text-[0.8125rem]", md: "h-10 px-5 text-sm" };

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md", className?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-sans font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md", className, ...rest }: { href: string; children: ReactNode; variant?: Variant; size?: "sm" | "md"; className?: string; target?: string; rel?: string; prefetch?: boolean; download?: boolean }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* ───────── Status ───────── */

export type Tone = "ok" | "warn" | "crit" | "info" | "idle" | "copper";

const toneClass: Record<Tone, string> = {
  ok: "bg-ok-50 text-ok",
  warn: "bg-warn-50 text-warn",
  crit: "bg-crit-50 text-crit",
  info: "bg-info-50 text-info",
  idle: "bg-idle-50 text-idle",
  copper: "bg-copper-50 text-copper",
};

/** Status label with a shape cue (not colour alone): ● on track, ▲ attention, ■ action, ○ inactive. */
const toneGlyph: Record<Tone, string> = { ok: "●", warn: "▲", crit: "■", info: "◆", idle: "○", copper: "◆" };

export function Status({ tone, children, className, glyph = true }: { tone: Tone; children: ReactNode; className?: string; glyph?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] font-sans text-[0.75rem] font-semibold", toneClass[tone], className)}>
      {glyph && (
        <span aria-hidden className="text-[0.6rem] leading-none">
          {toneGlyph[tone]}
        </span>
      )}
      {children}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-[3px] font-sans text-[0.75rem] font-medium text-ink-muted">{children}</span>;
}

/* ───────── Data display ───────── */

export function Progress({ value, label, tone = "info", size = "md", showValue = true }: { value: number; label: string; tone?: Tone; size?: "sm" | "md"; showValue?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const bar: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", info: "bg-navy", idle: "bg-idle", copper: "bg-lime-600" };
  return (
    <div className="flex items-center gap-2.5">
      <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className={clsx("relative w-full overflow-hidden rounded-full bg-canvas", size === "sm" ? "h-1.5" : "h-2")}>
        <div className={clsx("h-full rounded-full transition-[width] duration-500", bar[tone])} style={{ width: `${v}%` }} />
      </div>
      {showValue && <span className="w-9 shrink-0 text-right font-sans text-[0.8125rem] tabular-nums text-ink-muted">{v}%</span>}
    </div>
  );
}

/** A metric with its definition. Never shows a value without context. */
export function Metric({ label, value, context, definition, tone }: { label: string; value: ReactNode; context?: ReactNode; definition?: string; tone?: Tone }) {
  return (
    <div className="min-w-0 py-1">
      <dt className="type-meta flex items-center gap-1.5">
        {label}
        {tone && <span aria-hidden className={clsx("inline-block h-1.5 w-1.5 rounded-full", { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", info: "bg-info", idle: "bg-idle", copper: "bg-copper" }[tone])} />}
      </dt>
      <dd className="mt-1.5">
        <span className="type-figure">{value}</span>
        {context && <span className="ml-1.5 type-meta">{context}</span>}
      </dd>
      {definition && (
        <details className="group mt-1">
          <summary className="cursor-pointer list-none font-sans text-[0.75rem] text-ink-faint hover:text-navy-700 [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-dotted underline-offset-2">How is this calculated?</span>
          </summary>
          <p className="mt-1 text-[0.8125rem] leading-snug text-ink-muted">{definition}</p>
        </details>
      )}
    </div>
  );
}

export function MetricRow({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 | 7 }) {
  const c = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-4 2xl:grid-cols-7" }[cols];
  return <dl className={clsx("grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3", c)}>{children}</dl>;
}

export function Table({ children, caption, className }: { children: ReactNode; caption?: string; className?: string }) {
  return (
    <div className={clsx("-mx-6 overflow-x-auto", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left font-sans text-[0.8125rem]">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th scope="col" className={clsx("border-b border-line px-6 py-2.5 text-2xs font-semibold uppercase tracking-[0.06em] text-ink-faint first:pl-6", align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, align = "left", colSpan }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx("border-b border-line px-6 py-3 align-top text-ink", align === "right" && "text-right tabular-nums", align === "center" && "text-center", className)}>
      {children}
    </td>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-canvas/60 px-6 py-8 text-center">
      <p className="font-sans text-sm font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-[0.875rem] text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function KeyValue({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={clsx("grid gap-x-8 gap-y-3", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="type-eyebrow">{k}</dt>
          <dd className="mt-0.5 font-sans text-sm text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TabNav({ tabs, current }: { tabs: { key: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Sections" className="mb-6 overflow-x-auto">
      <ul className="inline-flex min-w-max gap-1 rounded-full bg-surface p-1 shadow-panel">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={clsx("inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-sans text-sm font-medium no-underline transition-colors", active ? "bg-navy text-white" : "text-ink-muted hover:bg-canvas hover:text-ink")}
              >
                {t.label}
                {t.count != null && <span className={clsx("rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums", active ? "bg-lime text-navy" : "bg-canvas text-ink-muted")}>{t.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between font-sans text-sm">
      <span className="text-ink-muted">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? <LinkButton href={hrefFor(page - 1)} variant="secondary" size="sm">Previous</LinkButton> : <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")} aria-disabled>Previous</span>}
        {page < pages ? <LinkButton href={hrefFor(page + 1)} variant="secondary" size="sm">Next</LinkButton> : <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")} aria-disabled>Next</span>}
      </div>
    </nav>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const bg: Record<Tone, string> = { ok: "bg-ok-50 border-l-ok", warn: "bg-warn-50 border-l-warn", crit: "bg-crit-50 border-l-crit", info: "bg-info-50 border-l-info", idle: "bg-idle-50 border-l-idle", copper: "bg-copper-50 border-l-copper" };
  return (
    <div role={tone === "crit" ? "alert" : "note"} className={clsx("rounded-2xl border-l-4 px-4 py-3 text-[0.875rem]", bg[tone])}>
      {title && <p className="font-sans font-semibold text-ink">{title}</p>}
      <div className={clsx("text-ink-muted", title && "mt-0.5")}>{children}</div>
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, required }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block font-sans text-[0.8125rem] font-medium text-ink">
        {label}
        {required && <span className="text-crit" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-[0.8125rem] text-ink-faint">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} className="font-sans text-[0.8125rem] text-crit">{error}</p>}
    </div>
  );
}
