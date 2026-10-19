"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="type-eyebrow">Something went wrong</p>
      <h1 className="type-display mt-1">We could not load this page</h1>
      <p className="mt-2 text-ink-muted">The error has been logged{error.digest ? ` (reference ${error.digest})` : ""}. Your learning records are unaffected.</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex h-9 items-center rounded bg-navy px-4 font-sans text-sm font-medium text-white">Try again</button>
    </div>
  );
}
