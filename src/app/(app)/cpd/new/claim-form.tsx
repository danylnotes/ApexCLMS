"use client";

import { useActionState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { createClaimAction } from "../../learner-actions";

/* Validation messages are English source text; they are translated when displayed. */
const schema = z.object({
  title: z.string().trim().min(4, "Enter an activity title"),
  type: z.string().min(1, "Choose an activity type"),
  provider: z.string().optional(),
  activityDate: z.string().min(1, "Enter the activity date").refine((d) => new Date(d).getTime() <= Date.now() + 86_400_000, "The date cannot be in the future"),
  durationHours: z.coerce.number({ invalid_type_error: "Enter the duration" }).positive("Duration must be greater than zero").max(200),
  claimedValue: z.coerce.number({ invalid_type_error: "Enter the value claimed" }).positive("Claimed value must be greater than zero"),
  description: z.string().trim().min(10, "Describe the activity (10+ characters)"),
  learningOutcomes: z.string().trim().min(10, "Describe what you learned (10+ characters)"),
  competencyId: z.string().optional(),
  recognition: z.enum(["COMPANY_RECORDED", "PROFESSIONAL_BODY"]),
  evidenceDescription: z.string().optional(),
  evidenceReference: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function ClaimForm({ types, competencies, unit, pointsPerHour, max }: { types: [string, string][]; competencies: { id: string; code: string; name: string }[]; unit: "HOURS" | "POINTS"; pointsPerHour: number; max: number | null }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createClaimAction, { ok: null });
  const formRef = useRef<HTMLFormElement>(null);
  const intent = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { recognition: "COMPANY_RECORDED", type: "" } });
  const hours = Number(watch("durationHours")) || 0;
  const suggested = Math.round(Math.min(unit === "POINTS" ? hours * pointsPerHour : hours, max ?? Infinity) * 100) / 100;
  const submitAs = (kind: "draft" | "submit") => handleSubmit(() => {
    intent.current!.value = kind;
    formRef.current!.requestSubmit();
  });
  const err = (k: keyof FormValues) => {
    const m = errors[k]?.message as string | undefined;
    return m ? t(m) : undefined;
  };
  const aria = (k: keyof FormValues) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-error` : undefined });

  return (
    <form ref={formRef} action={action} className="space-y-6 rounded-[22px] bg-surface p-6" encType="multipart/form-data" noValidate>
      <input type="hidden" name="intent" ref={intent} defaultValue="draft" />
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="type-section mb-3">{t("Activity")}</legend>
        <div className="sm:col-span-2"><Field label={t("Activity title")} htmlFor="title" error={err("title")} required><input id="title" className="input-base" {...register("title")} {...aria("title")} /></Field></div>
        <Field label={t("Activity type")} htmlFor="type" error={err("type")} required>
          <select id="type" className="input-base" {...register("type")} {...aria("type")}><option value="">{t("Select…")}</option>{types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label={t("Provider or organiser")} htmlFor="provider"><input id="provider" className="input-base" {...register("provider")} /></Field>
        <Field label={t("Activity date")} htmlFor="activityDate" error={err("activityDate")} required><input id="activityDate" type="date" className="input-base" {...register("activityDate")} {...aria("activityDate")} /></Field>
        <Field label={t("Duration (hours)")} htmlFor="durationHours" error={err("durationHours")} required><input id="durationHours" type="number" step="0.25" min="0" className="input-base" {...register("durationHours", { onChange: (e) => setValue("claimedValue", Math.round(Math.min(unit === "POINTS" ? Number(e.target.value) * pointsPerHour : Number(e.target.value), max ?? Infinity) * 100) / 100) })} {...aria("durationHours")} /></Field>
        <Field label={unit === "POINTS" ? t("CPD points claimed") : t("CPD hours claimed")} htmlFor="claimedValue" hint={hours ? t("Maximum under your policy: {value}", { value: suggested }) : undefined} error={err("claimedValue")} required><input id="claimedValue" type="number" step="0.25" min="0" className="input-base" {...register("claimedValue")} {...aria("claimedValue")} /></Field>
        <Field label={t("Related competency")} htmlFor="competencyId"><select id="competencyId" className="input-base" {...register("competencyId")}><option value="">{t("None")}</option>{competencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label={t("Description")} htmlFor="description" error={err("description")} required><textarea id="description" rows={3} className="input-base" {...register("description")} {...aria("description")} /></Field></div>
        <div className="sm:col-span-2"><Field label={t("Learning outcomes")} htmlFor="learningOutcomes" hint={t("What did you learn, and how will you apply it?")} error={err("learningOutcomes")} required><textarea id="learningOutcomes" rows={3} className="input-base" {...register("learningOutcomes")} {...aria("learningOutcomes")} /></Field></div>
        <fieldset className="sm:col-span-2">
          <legend className="font-sans text-[0.8125rem] font-medium">{t("Recognition")}</legend>
          <div className="mt-1.5 flex flex-col gap-1.5 text-[0.875rem] sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2"><input type="radio" value="COMPANY_RECORDED" {...register("recognition")} className="accent-[rgb(22,38,68)]" />{t("Company-recorded learning")}</label>
            <label className="flex items-center gap-2"><input type="radio" value="PROFESSIONAL_BODY" {...register("recognition")} className="accent-[rgb(22,38,68)]" />{t("Intended for professional-body CPD")}</label>
          </div>
        </fieldset>
      </fieldset>
      <fieldset className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
        <legend className="type-section mb-3 pt-5">{t("Supporting evidence")}</legend>
        <Field label={t("Evidence description")} htmlFor="evidenceDescription" hint={t("e.g. attendance certificate, agenda, published paper")}><input id="evidenceDescription" className="input-base" {...register("evidenceDescription")} /></Field>
        <Field label={t("Reference")} htmlFor="evidenceReference" hint={t("Certificate number, DOI or URL")}><input id="evidenceReference" className="input-base" {...register("evidenceReference")} /></Field>
        <div className="sm:col-span-2"><Field label={t("Evidence file (PDF, Office or image, up to 10 MB)")} htmlFor="evidenceFile"><input id="evidenceFile" name="evidenceFile" type="file" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg" className="block font-sans text-sm" /></Field></div>
      </fieldset>
      {state.ok === false && <p role="alert" className="rounded border border-crit/30 bg-crit-50 px-3 py-2 font-sans text-[0.8125rem] text-crit">{state.error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <button type="button" onClick={submitAs("submit")} className="inline-flex h-9 items-center rounded bg-navy px-4 font-sans text-sm font-medium text-white hover:bg-navy-700">{t("Submit for review")}</button>
        <button type="button" onClick={submitAs("draft")} className="inline-flex h-9 items-center rounded border border-line-strong bg-surface px-4 font-sans text-sm font-medium">{t("Save as draft")}</button>
      </div>
    </form>
  );
}
