"use client";

import { useI18n } from "@/i18n/client";

export function PrintButton() {
  const { t } = useI18n();
  return <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center rounded bg-navy px-4 font-sans text-sm font-medium text-white">{t("Print or save as PDF")}</button>;
}
