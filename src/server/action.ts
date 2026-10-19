import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AppError } from "./errors";
import type { ActionState } from "@/lib/action-state";

/** Runs a server action body and converts failures into a safe, displayable state. */
export async function runAction(fn: () => Promise<string | void>, revalidate: string[] = []): Promise<ActionState> {
  try {
    const message = await fn();
    for (const p of revalidate) revalidatePath(p, p.includes("[") ? "page" : undefined);
    return { ok: true, message: message ?? "Saved." };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      const fe = e.flatten();
      return { ok: false, error: fe.formErrors[0] ?? "Please correct the highlighted fields.", fieldErrors: fe.fieldErrors };
    }
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. The error has been logged; please try again." };
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
