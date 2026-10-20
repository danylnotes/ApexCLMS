import Link from "next/link";
import { Bell, HelpCircle, Search } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { prisma } from "@/server/db";
import { accessSummary } from "@/server/services/access";
import { navFor } from "@/lib/nav";
import { SideNav } from "@/components/shell";
import { initials } from "@/lib/format";
import { logoutAction } from "../(auth)/actions";

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: "Employee", MANAGER: "Line Manager", INSTRUCTOR: "Instructor", LD_ADMIN: "L&D Administrator", EXECUTIVE: "Executive" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const [{ branding }, unread, openAssignments, access] = await Promise.all([
    getSettings(),
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
    prisma.learningAssignment.count({ where: { userId: actor.id, status: "ASSIGNED", kind: "REQUIRED" } }),
    accessSummary(actor.id),
  ]);
  const groups = navFor(actor.permissions as Set<string>);
  const primaryRole = ["LD_ADMIN", "EXECUTIVE", "MANAGER", "INSTRUCTOR", "EMPLOYEE"].find((r) => actor.roles.includes(r)) ?? "EMPLOYEE";
  const firstName = actor.name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/, "").split(" ")[0];
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-50 rounded bg-navy px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>
      <SideNav
        groups={groups}
        brand={branding.productName}
        monogram={branding.monogram}
        badges={{ "/notifications": unread, "/my-learning": openAssignments }}
        access={{ staffId: access.staffId, jobTitle: access.jobRole?.title ?? null, grade: access.jobRole?.grade ?? null, levels: access.grants.length, allContent: access.allContent, pending: access.pendingCurrentRole }}
      />
      <div className="lg:pl-[268px]">
        <header className="flex flex-wrap items-center gap-3 pl-16 pr-4 pt-4 no-print sm:pr-6 lg:px-8 lg:pt-6">
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-[1.0625rem] font-bold tracking-[-0.01em] text-ink">Hello, {firstName} <span aria-hidden>👋</span> <span className="hidden font-medium text-ink-faint sm:inline">· {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span></p>
            <p className="truncate font-sans text-[0.75rem] text-ink-faint">
              {access.staffId ? `Staff ID ${access.staffId}` : "No staff ID"}
              {access.jobRole ? ` · ${access.jobRole.title}` : ""}
            </p>
          </div>
          <form action="/catalogue" role="search" className="relative order-last w-full sm:order-none sm:w-auto sm:min-w-[300px]">
            <label htmlFor="global-search" className="sr-only">Search the course catalogue</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input id="global-search" name="q" type="search" placeholder="Search courses, topics, codes" className="h-11 w-full rounded-full border-0 bg-surface pl-10 pr-4 font-sans text-sm text-ink shadow-panel placeholder:text-ink-faint focus:outline-none focus:ring-4 focus:ring-lime/50" />
          </form>
          <div className="flex items-center gap-2">
            {actor.isDemo && <span className="hidden rounded-full bg-lime px-2.5 py-1 font-sans text-[0.6875rem] font-semibold text-navy xl:inline">Demo account</span>}
            <Link href="/help" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-muted shadow-panel hover:text-ink" aria-label="Help and support">
              <HelpCircle className="h-[18px] w-[18px]" aria-hidden />
            </Link>
            <Link href="/notifications" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-muted shadow-panel hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="h-[18px] w-[18px]" aria-hidden />
              {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-crit ring-2 ring-surface" aria-hidden />}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 shadow-panel [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender font-sans text-[0.75rem] font-bold text-navy">{initials(actor.name)}</span>
                <span className="hidden text-left font-sans leading-tight md:block">
                  <span className="block text-[0.8125rem] font-semibold text-ink">{actor.name}</span>
                  <span className="block text-[0.6875rem] text-ink-faint">{ROLE_LABEL[primaryRole]}</span>
                </span>
              </summary>
              <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl bg-surface py-1.5 shadow-pop">
                <p className="truncate px-4 py-2 font-sans text-[0.75rem] text-ink-faint">{access.staffId} · {actor.email}</p>
                <Link href="/profile" className="block px-4 py-2 font-sans text-sm text-ink no-underline hover:bg-canvas">Profile and settings</Link>
                <Link href="/notifications" className="block px-4 py-2 font-sans text-sm text-ink no-underline hover:bg-canvas">Notifications</Link>
                <form action={logoutAction} className="mt-1 border-t border-line pt-1">
                  <button type="submit" className="block w-full px-4 py-2 text-left font-sans text-sm text-ink hover:bg-canvas">Sign out</button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-content px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
        <footer className="mx-auto max-w-content px-4 pb-10 font-sans text-[0.75rem] text-ink-faint sm:px-6 lg:px-8 no-print">
          {branding.productName} · {branding.organisationName} · Development records are confidential and visible only to you, your line management and authorised L&amp;D staff.
        </footer>
      </div>
    </div>
  );
}
