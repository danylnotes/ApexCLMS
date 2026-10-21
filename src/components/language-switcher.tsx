"use client";

import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/** Plain links to /lang so switching works without JavaScript; the current page is kept. */
const hrefFor = (locale: string, path: string) => `/lang?set=${locale}&next=${encodeURIComponent(path)}`;

export function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark" | "glass"; className?: string }) {
  const path = usePathname() || "/";
  const { locale, t } = useI18n();
  return (
    <nav aria-label={t("Language")} className={clsx("inline-flex items-center gap-1 rounded-full p-1", tone === "light" && "bg-canvas", tone === "dark" && "bg-white/10", tone === "glass" && "bg-black/25 backdrop-blur-md", className)}>
      <Languages className={clsx("mx-1.5 h-4 w-4 shrink-0", tone === "light" ? "text-ink-faint" : "text-white/80")} aria-hidden />
      {LOCALES.map((l) => (
        <a
          key={l}
          href={hrefFor(l, path)}
          lang={l}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          className={clsx(
            "rounded-full px-3 py-1.5 font-sans text-[0.8125rem] font-semibold no-underline transition-colors",
            l === locale ? "bg-lime text-navy" : tone === "light" ? "text-ink-muted hover:bg-surface hover:text-ink" : "text-white/85 hover:bg-white/15",
          )}
        >
          {LOCALE_META[l].label}
        </a>
      ))}
    </nav>
  );
}

/** Compact menu for the app header. */
export function LanguageMenu() {
  const path = usePathname() || "/";
  const { locale, t } = useI18n();
  return (
    <details className="relative">
      <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-full bg-surface px-3 font-sans text-[0.8125rem] font-semibold text-ink-muted shadow-panel hover:text-ink [&::-webkit-details-marker]:hidden" aria-label={t("Language")}>
        <Languages className="h-[18px] w-[18px]" aria-hidden />
        <span className="hidden sm:inline">{LOCALE_META[locale].short}</span>
      </summary>
      <div className="absolute end-0 z-40 mt-2 w-44 overflow-hidden rounded-2xl bg-surface py-1.5 shadow-pop">
        {LOCALES.map((l) => (
          <a key={l} href={hrefFor(l, path)} lang={l} hrefLang={l} aria-current={l === locale ? "true" : undefined} className={clsx("flex items-center justify-between px-4 py-2 font-sans text-sm no-underline hover:bg-canvas", l === locale ? "font-semibold text-ink" : "text-ink-muted")}>
            {LOCALE_META[l].label}
            {l === locale && <span className="h-2 w-2 rounded-full bg-lime-600" aria-hidden />}
          </a>
        ))}
      </div>
    </details>
  );
}
