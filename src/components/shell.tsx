"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Award, BadgeCheck, Bell, BookMarked, BookOpen, Building2, ClipboardList, Compass, FileBarChart, Gauge, GraduationCap, Grid3x3, History, LayoutDashboard, Library, LineChart, ListChecks, Presentation, Route, ScrollText, Send, Settings, ShieldCheck, Target, Users, Circle, Menu, X } from "lucide-react";

const ICONS = { Award, BadgeCheck, Bell, BookMarked, BookOpen, Building2, ClipboardList, Compass, FileBarChart, Gauge, GraduationCap, Grid3x3, History, LayoutDashboard, Library, LineChart, ListChecks, Presentation, Route, ScrollText, Send, Settings, ShieldCheck, Target, Users } as const;
import type { NavGroup } from "@/lib/nav";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name as keyof typeof ICONS] ?? Circle;
  return <C className={className} aria-hidden />;
}

function isActive(pathname: string, href: string, match?: string) {
  if (href === "/admin" || href === "/manager") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/") || (!!match && pathname.startsWith(match));
}

export interface AccessCard {
  staffId: string | null;
  jobTitle: string | null;
  grade: number | null;
  levels: number;
  allContent: boolean;
  pending: boolean;
}

export function SideNav({ groups, brand, monogram, badges = {}, access }: { groups: NavGroup[]; brand: string; monogram: string; badges?: Record<string, number>; access?: AccessCard }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
      {groups.map((g) => (
        <div key={g.label} className="mt-5 first:mt-1">
          <p className="mb-1.5 px-3 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-white/35">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(pathname, i.href, i.match);
              const badge = badges[i.href] ?? 0;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group flex items-center gap-3 rounded-full px-3 py-[9px] font-sans text-[0.8125rem] no-underline transition-colors",
                      active ? "bg-lime font-semibold text-navy" : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <Icon name={i.icon} className={clsx("h-[18px] w-[18px] shrink-0", active ? "text-navy" : "text-white/45 group-hover:text-white/80")} />
                    <span className="min-w-0 flex-1 truncate">{i.label}</span>
                    {badge > 0 && (
                      <span className={clsx("min-w-[20px] rounded-full px-1.5 text-center text-[0.6875rem] font-bold leading-5 tabular-nums", active ? "bg-navy text-lime" : "bg-lime text-navy")} aria-label={`${badge} pending`}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brandBlock = (
    <Link href="/dashboard" className="flex items-center gap-3 px-6 pb-4 pt-6 no-underline">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime font-sans text-[1rem] font-extrabold text-navy">{monogram}</span>
      <span className="min-w-0 font-sans text-[1.0625rem] font-bold leading-tight tracking-[-0.01em] text-white">{brand}</span>
    </Link>
  );

  const accessBlock = access && (
    <Link href="/profile#access" className="mx-3 mb-3 block rounded-[20px] bg-lime p-4 text-navy no-underline transition-transform hover:-translate-y-0.5">
      <span className="flex items-center justify-between">
        <span className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-navy/60">Access level</span>
        <ShieldCheck className="h-4 w-4 text-navy/70" aria-hidden />
      </span>
      <span className="mt-1.5 block font-sans text-[0.9375rem] font-bold leading-snug">{access.jobTitle ?? "No job title"}</span>
      <span className="mt-0.5 block font-sans text-[0.75rem] text-navy/70">
        {access.staffId ?? "—"}
        {access.grade ? ` · Grade ${access.grade}` : ""} · {access.allContent ? "all content" : `${access.levels} level${access.levels === 1 ? "" : "s"} open`}
      </span>
      {access.pending && !access.allContent && <span className="mt-2 block rounded-full bg-navy px-2.5 py-1 text-center font-sans text-[0.6875rem] font-semibold text-lime">Next level awaiting admin</span>}
    </Link>
  );

  return (
    <>
      <aside className="fixed bottom-3 left-3 top-3 z-30 hidden w-[252px] flex-col overflow-hidden rounded-[28px] bg-navy lg:flex">
        {brandBlock}
        {nav}
        {accessBlock}
      </aside>
      <button
        type="button"
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white shadow-pop lg:hidden no-print"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside id="mobile-nav" className="absolute bottom-2 left-2 top-2 flex w-[276px] flex-col overflow-hidden rounded-[26px] bg-navy pt-12 shadow-pop">
            {brandBlock}
            {nav}
            {accessBlock}
          </aside>
        </div>
      )}
    </>
  );
}
