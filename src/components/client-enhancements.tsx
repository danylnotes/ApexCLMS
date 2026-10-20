"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Small progressive enhancements for phone layouts:
 * - labels each table cell with its column heading, so tables can render as stacked cards;
 * - opens `details[data-desktop-open]` panels (e.g. catalogue filters) on wide screens.
 * The static demo builder inlines the same logic (scripts/build-static-demo.mjs).
 */
export function enhance(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>("table.rtable").forEach((t) => {
    const heads = Array.from(t.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
    t.querySelectorAll("tbody tr").forEach((tr) => {
      let col = 0;
      for (const td of Array.from(tr.children)) {
        if (col > 0 && !td.hasAttribute("data-label")) td.setAttribute("data-label", heads[col] ?? "");
        col += Number(td.getAttribute("colspan") ?? 1);
      }
    });
  });
  if (window.matchMedia("(min-width: 1024px)").matches) {
    root.querySelectorAll<HTMLDetailsElement>("details[data-desktop-open]:not([data-enhanced])").forEach((d) => {
      d.open = true;
      d.setAttribute("data-enhanced", "");
    });
  }
}

export function ClientEnhancements() {
  const pathname = usePathname();
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => enhance(document));
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return null;
}
