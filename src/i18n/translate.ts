import { LOCALE_META, type Locale } from "./config";

export type Vars = Record<string, string | number | null | undefined>;
export type Dictionary = Record<string, string>;

/**
 * Message format: the key is the English text. Placeholders use {name}; plurals use a small ICU
 * subset, e.g. "{count, plural, one {# course} other {# courses}}" (Arabic may add zero/two/few/many).
 * Missing translations fall back to the English key.
 */
export function translate(dict: Dictionary, locale: Locale, key: string, vars?: Vars): string {
  const template = (locale === "en" ? undefined : dict[key]) ?? key;
  return format(template, locale, vars);
}

const PLURAL = /\{(\w+),\s*plural,\s*((?:[^{}]*\{[^{}]*\})+)\s*\}/g;

export function format(template: string, locale: Locale, vars?: Vars): string {
  let out = template;
  if (out.includes("plural")) {
    const rules = new Intl.PluralRules(LOCALE_META[locale].intl);
    out = out.replace(PLURAL, (_m, name: string, body: string) => {
      const n = Number(vars?.[name] ?? 0);
      const forms: Record<string, string> = {};
      for (const f of body.matchAll(/(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) forms[f[1]] = f[2];
      const chosen = forms[`=${n}`] ?? forms[rules.select(n)] ?? forms.other ?? "";
      return chosen.replace(/#/g, String(n));
    });
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, name: string) => (vars[name] == null ? m : String(vars[name])));
  return out;
}
