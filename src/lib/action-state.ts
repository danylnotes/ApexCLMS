export interface ActionState {
  ok: boolean | null;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  data?: Record<string, unknown>;
}
