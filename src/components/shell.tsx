"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Award, BadgeCheck, BookMarked, BookOpen, Building2, ClipboardList, Compass, FileBarChart, Gauge, GraduationCap, Grid3x3, History, LayoutDashboard, Library, LineChart, ListChecks, Presentation, Route, ScrollText, Send, Settings, ShieldCheck, Target, Users, Circle, Menu, X } from "lucide-react";

const ICONS = { Award, BadgeCheck, BookMarked, BookOpen, Building2, ClipboardList, Compass, FileBarChart, Gauge, GraduationCap, Grid3x3, History, LayoutDashboard, Library, LineChart, ListChecks, Presentation, Route, ScrollText, Send, Settings, ShieldCheck, Target, Users } as const;
import type { NavGroup } from "@/lib/nav";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name as keyof typeof ICONS] ?? Circle;
  return <C className={className} aria-hidden />;
}

function isActive(pathname: string, href: string, match?: string) {
  if (href === "/admin" || href === "/manager") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/") || (!!match && pathname.startsWith(match));
}

export function SideNav({ groups, brand, monogram }: { groups: NavGroup[]; brand: string; monogram: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
      {groups.map((g) => (
        <div key={g.label} className="mt-6 first:mt-2">
          <p className="mb-1.5 px-2.5 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-white/45">{g.label}</p>
          <ul className="space-y-px">
            {g.items.map((i) => {
              const active = isActive(pathname, i.href, i.match);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "group flex items-center gap-2.5 rounded px-2.5 py-[7px] font-sans text-[0.8125rem] no-underline transition-colors",
                      active ? "bg-white/[0.09] font-medium text-white" : "text-white/70 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    <Icon name={i.icon} className={clsx("h-4 w-4 shrink-0", active ? "text-[#E2B48C]" : "text-white/45 group-hover:text-white/70")} />
                    {i.label}
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
    <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 no-underline">
      <span className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-white/25 font-serif text-[1.05rem] font-semibold text-white">{monogram}</span>
      <span className="min-w-0 font-sans text-[0.8125rem] font-semibold leading-tight text-white">{brand}</span>
    </Link>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-navy lg:flex">
        {brandBlock}
        {nav}
      </aside>
      <button
        type="button"
        className="fixed left-3 top-2.5 z-40 inline-flex h-9 w-9 items-center justify-center rounded border border-line bg-surface text-ink lg:hidden no-print"
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
          <aside id="mobile-nav" className="absolute inset-y-0 left-0 flex w-[272px] flex-col bg-navy pt-12 shadow-pop">
            {brandBlock}
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
