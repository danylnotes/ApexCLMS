import { ZodError } from "zod";

export type ErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export const forbidden = (msg = "You do not have permission to perform this action.") => new AppError("FORBIDDEN", msg);
export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`);
export const invalid = (msg: string, details?: Record<string, unknown>) => new AppError("VALIDATION", msg, details);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);

/** Normalises any thrown value into a safe, consistent error shape (no internals leaked). */
export function toErrorBody(e: unknown): { status: number; body: { error: { code: ErrorCode; message: string; details?: unknown } } } {
  if (e instanceof AppError) return { status: e.status, body: { error: { code: e.code, message: e.message, details: e.details } } };
  if (e instanceof ZodError)
    return { status: 422, body: { error: { code: "VALIDATION", message: "The submitted data is invalid.", details: e.flatten().fieldErrors } } };
  console.error("[unhandled]", e);
  return { status: 500, body: { error: { code: "INTERNAL", message: "An unexpected error occurred. The incident has been logged." } } };
}
