/** Supported interface languages. English is the source language; message keys are the English text. */
export const LOCALES = ["en", "ar", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "apex_lang";

export const LOCALE_META: Record<Locale, { label: string; short: string; dir: "ltr" | "rtl"; intl: string }> = {
  en: { label: "English", short: "EN", dir: "ltr", intl: "en-GB" },
  // Latin digits keep codes, IDs and figures consistent with the underlying records.
  ar: { label: "العربية", short: "ع", dir: "rtl", intl: "ar-u-nu-latn" },
  fr: { label: "Français", short: "FR", dir: "ltr", intl: "fr-FR" },
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Picks the best supported language from an Accept-Language header. */
export function negotiate(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
