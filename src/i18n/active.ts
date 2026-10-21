import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_META, type Locale } from "./config";
import { translate, type Dictionary, type Vars } from "./translate";

/**
 * The language of the request being rendered. Set by getLocale() (src/i18n/server.ts), which the root
 * layout calls before anything else renders. Outside a server render (tests, scripts) it is English.
 */
const store = cache(() => ({ locale: DEFAULT_LOCALE as Locale }));

export const setActiveLocale = (l: Locale) => {
  store().locale = l;
};
export const activeLocale = (): Locale => store().locale;
export const activeIntl = () => LOCALE_META[activeLocale()].intl;

/*
 * Dictionaries are registered by src/i18n/server.ts (loaded by the root layout), so modules shared with
 * client components can import this file without pulling every translation into the browser bundle.
 */
let lookup: (l: Locale) => Dictionary = () => ({});
export const registerDictionaries = (fn: (l: Locale) => Dictionary) => {
  lookup = fn;
};

/** Synchronous translation for server code that cannot await (formatters, status labels, domain text). */
export function tr(key: string, vars?: Vars): string {
  const l = activeLocale();
  return translate(lookup(l), l, key, vars);
}
