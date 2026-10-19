import Link from "next/link";
import { Bell, HelpCircle, Search } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { prisma } from "@/server/db";
import { navFor } from "@/lib/nav";
import { SideNav } from "@/components/shell";
import { initials } from "@/lib/format";
import { logoutAction } from "../(auth)/actions";

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Employee", MANAGER: "Line Manager", INSTRUCTOR: "Instructor", LD_ADMIN: "L&D Administrator", EXECUTIVE: "Executive" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const [{ branding }, unread] = await Promise.all([getSettings(), prisma.notification.count({ where: { userId: actor.id, readAt: null } })]);
  const groups = navFor(actor.permissions as Set<string>);
  const primaryRole = ["LD_ADMIN", "EXECUTIVE", "MANAGER", "INSTRUCTOR", "EMPLOYEE"].find((r) => actor.roles.includes(r)) ?? "EMPLOYEE";
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-navy px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>
      <SideNav groups={groups} brand={branding.productName} monogram={branding.monogram} />
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 pl-14 pr-4 backdrop-blur no-print lg:px-8">
          <form action="/catalogue" role="search" className="relative hidden max-w-sm flex-1 sm:block">
            <label htmlFor="global-search" className="sr-only">Search the course catalogue</label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input id="global-search" name="q" type="search" placeholder="Search courses, topics, codes" className="input-base h-9 !pl-8" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            {actor.isDemo && <span className="mr-2 hidden rounded-[3px] border border-copper/30 bg-copper-50 px-1.5 py-0.5 font-sans text-[0.6875rem] font-medium text-copper md:inline">Demonstration account</span>}
            <Link href="/help" className="inline-flex h-9 w-9 items-center justify-center rounded text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Help and support">
              <HelpCircle className="h-[18px] w-[18px]" aria-hidden />
            </Link>
            <Link href="/notifications" className="relative inline-flex h-9 w-9 items-center justify-center rounded text-ink-muted hover:bg-canvas hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="h-[18px] w-[18px]" aria-hidden />
              {unread > 0 && <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-copper px-1 text-center font-sans text-[0.625rem] font-semibold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <details className="relative ml-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded py-1 pl-1 pr-2 hover:bg-canvas [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-50 font-sans text-[0.6875rem] font-semibold text-navy">{initials(actor.name)}</span>
                <span className="hidden text-left font-sans leading-tight md:block">
                  <span className="block text-[0.8125rem] font-medium text-ink">{actor.name}</span>
                  <span className="block text-[0.6875rem] text-ink-faint">{ROLE_LABEL[primaryRole]}</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-1 w-56 rounded-md border border-line bg-surface py-1 shadow-pop">
                <p className="truncate px-3 py-2 font-sans text-[0.75rem] text-ink-faint">{actor.email}</p>
                <Link href="/profile" className="block px-3 py-1.5 font-sans text-sm text-ink no-underline hover:bg-canvas">Profile and settings</Link>
                <Link href="/notifications" className="block px-3 py-1.5 font-sans text-sm text-ink no-underline hover:bg-canvas">Notifications</Link>
                <form action={logoutAction} className="border-t border-line mt-1 pt-1">
                  <button type="submit" className="block w-full px-3 py-1.5 text-left font-sans text-sm text-ink hover:bg-canvas">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
        <footer className="mx-auto max-w-content px-4 pb-10 font-sans text-[0.75rem] text-ink-faint sm:px-6 lg:px-10 no-print">
          {branding.productName} · {branding.organisationName} · Development records are confidential and visible only to you, your line management and authorised L&amp;D staff.
        </footer>
      </div>
    </div>
  );
}
