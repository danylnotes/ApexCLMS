import type { Webinar } from "@prisma/client";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field } from "@/components/ui";
import { saveWebinarAction } from "../../staff-actions";

function localInput(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export async function WebinarForm({ w }: { w?: Webinar }) {
  const categories = await prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return (
    <ActionForm action={saveWebinarAction} className="grid gap-4 md:grid-cols-4">
      {w && <input type="hidden" name="webinarId" value={w.id} />}
      <Field label="Code" htmlFor="code" required><input id="code" name="code" defaultValue={w?.code} required className="input-base uppercase" /></Field>
      <div className="md:col-span-3"><Field label="Title" htmlFor="title" required><input id="title" name="title" defaultValue={w?.title} required className="input-base" /></Field></div>
      <div className="md:col-span-4"><Field label="Synopsis" htmlFor="synopsis" required><textarea id="synopsis" name="synopsis" rows={2} defaultValue={w?.synopsis} required className="input-base" /></Field></div>
      <div className="md:col-span-4"><Field label="Overview" htmlFor="overview" required><textarea id="overview" name="overview" rows={4} defaultValue={w?.overview} required className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label="Learning objectives (one per line)" htmlFor="objectives"><textarea id="objectives" name="objectives" rows={3} defaultValue={w?.objectives.join("\n")} className="input-base" /></Field></div>
      <div className="md:col-span-2"><Field label="Registration requirements" htmlFor="registrationRequirements"><textarea id="registrationRequirements" name="registrationRequirements" rows={3} defaultValue={w?.registrationRequirements ?? ""} className="input-base" /></Field></div>
      <Field label="Speaker" htmlFor="speakerName" required><input id="speakerName" name="speakerName" defaultValue={w?.speakerName} required className="input-base" /></Field>
      <Field label="Speaker title" htmlFor="speakerTitle"><input id="speakerTitle" name="speakerTitle" defaultValue={w?.speakerTitle ?? ""} className="input-base" /></Field>
      <div className="md:col-span-2"><Field label="Speaker biography" htmlFor="speakerBio"><input id="speakerBio" name="speakerBio" defaultValue={w?.speakerBio ?? ""} className="input-base" /></Field></div>
      <Field label="Start (local time in event time zone)" htmlFor="startsAt" required><input id="startsAt" name="startsAt" type="datetime-local" defaultValue={w ? localInput(w.startsAt, w.timeZone) : ""} required className="input-base" /></Field>
      <Field label="Time zone (IANA)" htmlFor="timeZone" required><input id="timeZone" name="timeZone" defaultValue={w?.timeZone ?? "Asia/Baghdad"} required className="input-base" /></Field>
      <Field label="Duration (minutes)" htmlFor="durationMinutes" required><input id="durationMinutes" name="durationMinutes" type="number" min={10} defaultValue={w?.durationMinutes ?? 60} className="input-base" /></Field>
      <Field label="Capacity" htmlFor="capacity" hint="Blank = unlimited"><input id="capacity" name="capacity" type="number" min={1} defaultValue={w?.capacity ?? ""} className="input-base" /></Field>
      <Field label="Category" htmlFor="categoryId"><select id="categoryId" name="categoryId" defaultValue={w?.categoryId ?? ""} className="input-base"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Meeting platform" htmlFor="meetingProvider" hint="Records the platform only; no live integration."><select id="meetingProvider" name="meetingProvider" defaultValue={w?.meetingProvider ?? "MICROSOFT_TEAMS"} className="input-base"><option value="MICROSOFT_TEAMS">Microsoft Teams</option><option value="ZOOM">Zoom</option><option value="OTHER">Other</option><option value="NONE">In person / none</option></select></Field>
      <div className="md:col-span-2"><Field label="Meeting link (registrants only)" htmlFor="meetingUrl"><input id="meetingUrl" name="meetingUrl" type="url" defaultValue={w?.meetingUrl ?? ""} className="input-base" /></Field></div>
      <label className="flex items-end gap-2 pb-2 font-sans text-sm"><input type="checkbox" name="cpdEligible" defaultChecked={w?.cpdEligible ?? false} className="h-4 w-4 accent-[rgb(22,38,68)]" />CPD-eligible</label>
      <Field label="CPD value (hours)" htmlFor="cpdValue"><input id="cpdValue" name="cpdValue" type="number" step="0.25" min={0} defaultValue={w?.cpdValue ? Number(w.cpdValue) : ""} className="input-base" /></Field>
      <Field label="Minimum attendance (minutes)" htmlFor="minAttendanceMinutes"><input id="minAttendanceMinutes" name="minAttendanceMinutes" type="number" min={1} defaultValue={w?.minAttendanceMinutes ?? ""} className="input-base" /></Field>
      <label className="flex items-end gap-2 pb-2 font-sans text-sm"><input type="checkbox" name="draft" defaultChecked={w?.status === "DRAFT"} className="h-4 w-4 accent-[rgb(22,38,68)]" />Save as draft (hidden)</label>
      <div className="md:col-span-4"><SubmitButton>{w ? "Save webinar" : "Schedule webinar"}</SubmitButton></div>
    </ActionForm>
  );
}
