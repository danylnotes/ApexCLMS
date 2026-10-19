import { cache } from "react";
import { prisma } from "./db";
import { DEFAULT_HEALTH_RULES, type HealthRules } from "@/lib/domain/health";

export interface Branding {
  productName: string;
  descriptor: string;
  organisationName: string;
  monogram: string;
  supportEmail: string;
  loginHeadline: string;
  loginBody: string;
}

export interface SecuritySettings {
  sessionTtlHours: number;
  sessionIdleMinutes: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
}

export interface LearningPolicy {
  defaultPassingScore: number;
  defaultMaxAttempts: number;
  mandatoryDueSoonDays: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  webinarReminderHours: number;
}

export interface PlatformSettings {
  branding: Branding;
  security: SecuritySettings;
  health: HealthRules;
  learning: LearningPolicy;
  notifications: NotificationSettings;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  branding: {
    productName: "APEX Learning & Development",
    descriptor: "Developing Competence. Strengthening Performance. Advancing Careers.",
    organisationName: "Your Organisation",
    monogram: "A",
    supportEmail: "learning.support@example.com",
    loginHeadline: "Competence is built deliberately.",
    loginBody:
      "Structured learning, verified competence and transparent development records for every role — from the control room to the boardroom.",
  },
  security: {
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
    sessionIdleMinutes: Number(process.env.SESSION_IDLE_MINUTES ?? 60),
    maxFailedLogins: 5,
    lockoutMinutes: 15,
  },
  health: DEFAULT_HEALTH_RULES,
  learning: { defaultPassingScore: 70, defaultMaxAttempts: 3, mandatoryDueSoonDays: 30 },
  notifications: { emailEnabled: false, webinarReminderHours: 24 },
};

export type SettingKey = keyof PlatformSettings;

async function load(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany();
  const out = structuredClone(DEFAULT_SETTINGS) as PlatformSettings;
  for (const r of rows) {
    const k = r.key as SettingKey;
    if (k in out && r.value && typeof r.value === "object") {
      (out as unknown as Record<string, object>)[k] = { ...(out[k] as object), ...(r.value as object) };
    }
  }
  return out;
}

/** Per-request cached settings (merged over defaults). */
export const getSettings = cache(load);
export const loadSettingsUncached = load;
