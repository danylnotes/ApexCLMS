import { getSettings } from "@/server/settings";

/** Plant photography from the organisation's own library; rotated slowly behind the sign-in panel. */
const PHOTOS = [
  { src: "/login/plant-flare.jpg", position: "center 60%" },
  { src: "/login/plant-daylight.jpg", position: "center 55%" },
  { src: "/login/plant-blue.jpg", position: "center 40%" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { branding } = await getSettings();
  return (
    <div className="min-h-screen bg-navy lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-3 lg:bg-canvas lg:p-3">
      {/* Phones: full-width photo header; the form rises over it as a sheet. */}
      <section className="relative h-[52vh] min-h-[340px] overflow-hidden text-white lg:hidden" aria-label={`${branding.productName} — industrial plant`}>
        <div aria-hidden className="absolute inset-0">
          {PHOTOS.map((p, i) => (
            <div key={p.src} className="login-photo absolute inset-0 bg-cover" style={{ backgroundImage: `url(${p.src})`, backgroundPosition: p.position, animationDelay: `${i * 8}s` }} />
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(24_26_31/0.6)_0%,rgb(24_26_31/0.05)_30%,rgb(24_26_31/0.2)_55%,rgb(24_26_31/0.9)_100%)]" />
        </div>
        <div className="relative flex items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime font-sans text-xl font-extrabold text-navy">{branding.monogram}</span>
          <div>
            <p className="font-sans text-lg font-bold leading-tight">{branding.productName}</p>
            <p className="font-sans text-[0.75rem] text-white/75">{branding.organisationName}</p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-14 px-5">
          <p className="font-sans text-[2rem] font-extrabold leading-[1.05] tracking-[-0.03em]">{branding.loginHeadline}</p>
        </div>
      </section>
      <aside className="relative hidden min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[32px] bg-navy text-white lg:flex lg:flex-col lg:justify-between" aria-label={`${branding.productName} — industrial plant`}>
        <div aria-hidden className="absolute inset-0">
          {PHOTOS.map((p, i) => (
            <div
              key={p.src}
              className="login-photo absolute inset-0 bg-cover"
              style={{ backgroundImage: `url(${p.src})`, backgroundPosition: p.position, animationDelay: `${i * 8}s` }}
            />
          ))}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(24_26_31/0.55)_0%,rgb(24_26_31/0.05)_35%,rgb(24_26_31/0.25)_60%,rgb(24_26_31/0.92)_100%)]" />
        </div>
        <div className="relative flex items-center justify-between px-10 pt-9">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime font-sans text-xl font-extrabold text-navy">{branding.monogram}</span>
            <div>
              <p className="font-sans text-lg font-bold leading-tight">{branding.productName}</p>
              <p className="font-sans text-[0.75rem] text-white/70">{branding.organisationName}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 font-sans text-[0.75rem] font-medium backdrop-blur">Competency &amp; Learning Management</span>
        </div>
        <div className="relative max-w-2xl px-10 pb-10">
          <h1 className="font-sans text-[2.75rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">{branding.loginHeadline}</h1>
          <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-white/80">{branding.loginBody}</p>
          <dl className="mt-8 grid grid-cols-3 gap-3 font-sans">
            {[
              ["Learn", "Courses, paths and live sessions for your job title"],
              ["Demonstrate", "Evidence-based competency records"],
              ["Progress", "Next-level access opened by your administrator"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <dt className="text-sm font-bold text-lime">{k}</dt>
                <dd className="mt-1 text-[0.8125rem] leading-snug text-white/80">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
      <main className="relative -mt-9 flex justify-center rounded-t-[32px] bg-surface px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-7 sm:px-10 lg:mt-0 lg:min-h-[calc(100vh-1.5rem)] lg:items-center lg:rounded-[32px] lg:py-10">
        <div className="w-full max-w-[420px]">
          <div aria-hidden className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-line-strong lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
