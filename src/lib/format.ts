import { activeIntl, tr } from "@/i18n/active";

/* Formatting follows the language of the current request (English outside a server render). */
const CACHE = new Map<string, Intl.DateTimeFormat>();
function dtf(options: Intl.DateTimeFormatOptions, timeZone = "UTC") {
  const key = `${activeIntl()}|${timeZone}|${JSON.stringify(options)}`;
  if (!CACHE.has(key)) CACHE.set(key, new Intl.DateTimeFormat(activeIntl(), { ...options, timeZone }));
  return CACHE.get(key)!;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dtf({ day: "numeric", month: "short", year: "numeric" }).format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateTime(d: Date | string, timeZone = "UTC"): string {
  return dtf({ weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }, timeZone).format(typeof d === "string" ? new Date(d) : d);
}

/** Long weekday/day/month, e.g. for the header greeting. */
export function fmtToday(d = new Date()): string {
  return dtf({ weekday: "long", day: "numeric", month: "long" }).format(d);
}

export function fmtRelative(d: Date | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return tr("today");
  if (days === 1) return tr("tomorrow");
  if (days === -1) return tr("yesterday");
  if (days > 0) return days < 60 ? tr("{count, plural, one {in # day} other {in # days}}", { count: days }) : tr("{count, plural, one {in # month} other {in # months}}", { count: Math.round(days / 30) });
  return -days < 60 ? tr("{count, plural, one {# day ago} other {# days ago}}", { count: -days }) : tr("{count, plural, one {# month ago} other {# months ago}}", { count: Math.round(-days / 30) });
}

export function fmtHours(h: number | string | null | undefined): string {
  if (h == null) return "—";
  const n = Number(h);
  return tr("{n} h", { n: Number.isInteger(n) ? n : n.toFixed(1) });
}

export function fmtMinutes(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 60) return tr("{n} min", { n: m });
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? tr("{h} h {m} min", { h, m: r }) : tr("{n} h", { n: h });
}

export function fmtNum(n: number | string | null | undefined, unit?: string): string {
  if (n == null) return "—";
  const v = Number(n);
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return unit ? `${s} ${unit}` : s;
}

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/(^|\s)\S/g, (c) => c.toUpperCase());
export const sentence = (s: string) => {
  const t = s.toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function initials(name: string) {
  return name
    .replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
