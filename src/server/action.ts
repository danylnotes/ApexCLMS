import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AppError } from "./errors";
import type { ActionState } from "@/lib/action-state";
import { getI18n } from "@/i18n/server";

/**
 * Runs a server action body and converts failures into a safe, displayable state. Messages are shown
 * in the user's language: service messages are English source text looked up in the dictionaries.
 */
export async function runAction(fn: () => Promise<string | void>, revalidate: string[] = []): Promise<ActionState> {
  const { t } = await getI18n();
  try {
    const message = await fn();
    for (const p of revalidate) revalidatePath(p, p.includes("[") ? "page" : undefined);
    return { ok: true, message: t(message ?? "Saved.") };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) {
      if (e.template) return { ok: false, error: t(e.template.key, Object.fromEntries(Object.entries(e.template.vars).map(([k, v]) => [k, t(v)]))) };
      return { ok: false, error: t(e.message) };
    }
    if (e instanceof ZodError) {
      const fe = e.flatten();
      const fieldErrors = Object.fromEntries(Object.entries(fe.fieldErrors).map(([k, v]) => [k, v?.map((m) => t(m))]));
      return { ok: false, error: t(fe.formErrors[0] ?? "Please correct the highlighted fields."), fieldErrors };
    }
    console.error("[action]", e);
    return { ok: false, error: t("Something went wrong. The error has been logged; please try again.") };
  }
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
export const optStr = (fd: FormData, k: string) => {
  const v = str(fd, k).trim();
  return v === "" ? null : v;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
