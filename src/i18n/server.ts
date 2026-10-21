import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, LOCALE_META, isLocale, negotiate, type Locale } from "./config";
import { serverDictionary } from "./catalog";
import { translate, type Vars } from "./translate";
import { registerDictionaries, setActiveLocale } from "./active";

registerDictionaries(serverDictionary);

/** The visitor's language: the language cookie, else the browser's Accept-Language, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen) ? chosen : negotiate((await headers()).get("accept-language"));
  setActiveLocale(locale);
  return locale;
});

export function i18nFor(locale: Locale) {
  const dict = serverDictionary(locale);
  return { locale, ...LOCALE_META[locale], t: (key: string, vars?: Vars) => translate(dict, locale, key, vars) };
}

/** Use in server components, server actions and route handlers: `const { t } = await getI18n();` */
export async function getI18n() {
  return i18nFor(await getLocale());
}
