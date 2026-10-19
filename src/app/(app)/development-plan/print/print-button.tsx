"use client";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center rounded bg-navy px-4 font-sans text-sm font-medium text-white">Print or save as PDF</button>;
}
