"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="type-eyebrow">{t("Something went wrong")}</p>
      <h1 className="type-display mt-1">{t("We could not load this page")}</h1>
      <p className="mt-2 text-ink-muted">{error.digest ? t("The error has been logged (reference {ref}). Your learning records are unaffected.", { ref: error.digest }) : t("The error has been logged. Your learning records are unaffected.")}</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex h-10 items-center rounded-full bg-navy px-5 font-sans text-sm font-semibold text-white">{t("Try again")}</button>
    </div>
  );
}
