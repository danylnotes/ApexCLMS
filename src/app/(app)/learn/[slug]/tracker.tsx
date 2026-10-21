"use client";

import { useEffect, useRef } from "react";
import { heartbeat } from "../../learner-actions";
import { useI18n } from "@/i18n/client";

/**
 * Records time on a lesson while the page is visible (30-second heartbeats; server caps each beat).
 * Video lessons also report playback position. Progress is persisted server-side, never only in the browser.
 */
export function LessonTracker({ lessonId, enabled }: { lessonId: string; enabled: boolean }) {
  const last = useRef(Date.now());
  useEffect(() => {
    if (!enabled) return;
    heartbeat(lessonId, 0).catch(() => undefined);
    last.current = Date.now();
    const flush = () => {
      const secs = Math.round((Date.now() - last.current) / 1000);
      last.current = Date.now();
      if (secs > 0 && document.visibilityState === "visible") heartbeat(lessonId, Math.min(secs, 120)).catch(() => undefined);
    };
    const t = setInterval(flush, 30_000);
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
      else last.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [lessonId, enabled]);
  return null;
}

export function TrackedVideo({ lessonId, src, start }: { lessonId: string; src: string; start: number | null }) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  const lastSent = useRef(0);
  return (
    <video
      ref={ref}
      src={src}
      controls
      preload="metadata"
      className="aspect-video w-full rounded border border-line bg-ink"
      onLoadedMetadata={() => {
        if (start && ref.current) ref.current.currentTime = start;
      }}
      onTimeUpdate={() => {
        const v = ref.current;
        if (!v || Date.now() - lastSent.current < 15_000) return;
        lastSent.current = Date.now();
        heartbeat(lessonId, 0, v.currentTime).catch(() => undefined);
      }}
    >
      {t("Your browser does not support embedded video.")} <a href={src}>{t("Open the video")}</a>.
    </video>
  );
}
