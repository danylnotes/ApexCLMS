"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LOCALE_META, type Locale } from "./config";
import { translate, type Dictionary, type Vars } from "./translate";

const Ctx = createContext<{ locale: Locale; dict: Dictionary }>({ locale: "en", dict: {} });

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Use in client components: `const { t } = useI18n();` Strings must be in a locales/*\/client-*.ts file. */
export function useI18n() {
  const { locale, dict } = useContext(Ctx);
  return { locale, ...LOCALE_META[locale], t: (key: string, vars?: Vars) => translate(dict, locale, key, vars) };
}
