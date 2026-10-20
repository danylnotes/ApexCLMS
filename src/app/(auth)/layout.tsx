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
    <div className="min-h-screen bg-canvas p-3 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-3">
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
      <main className="flex min-h-[calc(100vh-1.5rem)] items-center justify-center rounded-[32px] bg-surface px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime font-sans text-lg font-extrabold text-navy">{branding.monogram}</span>
            <p className="font-sans text-base font-bold text-ink">{branding.productName}</p>
          </div>
          <div aria-hidden className="relative mb-8 h-36 overflow-hidden rounded-3xl lg:hidden">
            <div className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${PHOTOS[0].src})`, backgroundPosition: PHOTOS[0].position }} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
