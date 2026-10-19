const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DATETIME_CACHE = new Map<string, Intl.DateTimeFormat>();

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return DATE.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateTime(d: Date | string, timeZone = "UTC"): string {
  const key = timeZone;
  if (!DATETIME_CACHE.has(key)) {
    DATETIME_CACHE.set(key, new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone, timeZoneName: "short" }));
  }
  return DATETIME_CACHE.get(key)!.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtRelative(d: Date | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return days < 60 ? `in ${days} days` : `in ${Math.round(days / 30)} months`;
  return -days < 60 ? `${-days} days ago` : `${Math.round(-days / 30)} months ago`;
}

export function fmtHours(h: number | string | null | undefined): string {
  if (h == null) return "—";
  const n = Number(h);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} h`;
}

export function fmtMinutes(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
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
