import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="type-eyebrow">Error 404</p>
      <h1 className="type-display mt-1">Page not found</h1>
      <p className="mt-2 text-ink-muted">The page does not exist, or you do not have access to the record you requested.</p>
      <p className="mt-6 font-sans text-sm"><Link href="/dashboard">Return to your dashboard</Link></p>
    </main>
  );
}
