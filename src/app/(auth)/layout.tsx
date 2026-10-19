import { getSettings } from "@/server/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { branding } = await getSettings();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <div className="relative px-12 pt-12">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/30 font-serif text-lg font-semibold">{branding.monogram}</span>
            <div>
              <p className="font-sans text-sm font-semibold">{branding.productName}</p>
              <p className="font-sans text-[0.75rem] text-white/60">{branding.organisationName}</p>
            </div>
          </div>
        </div>
        <div className="relative max-w-lg px-12">
          <p className="type-eyebrow !text-[#E2B48C]">Learning · Competence · Careers</p>
          <h1 className="mt-3 font-serif text-[2.25rem] font-semibold leading-[1.15] text-white">{branding.loginHeadline}</h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-white/75">{branding.loginBody}</p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-6 font-sans">
            {[
              ["Learn", "Structured courses, paths and live sessions"],
              ["Demonstrate", "Evidence-based competency records"],
              ["Progress", "Transparent development planning"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-semibold text-white">{k}</dt>
                <dd className="mt-1 text-[0.8125rem] leading-snug text-white/60">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative px-12 pb-10 font-sans text-[0.75rem] text-white/45">{branding.descriptor}</p>
      </aside>
      <main className="flex min-h-screen items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-navy font-serif text-lg font-semibold text-white">{branding.monogram}</span>
            <p className="font-sans text-sm font-semibold text-navy">{branding.productName}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
