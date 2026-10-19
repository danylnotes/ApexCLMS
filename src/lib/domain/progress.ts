/** Course progress is calculated from required lessons only; optional lessons never block progress. */
export interface LessonRef {
  id: string;
  isRequired: boolean;
}

export interface ProgressResult {
  completed: number;
  total: number;
  percent: number;
}

export function courseProgress(lessons: LessonRef[], completedLessonIds: Iterable<string>): ProgressResult {
  const done = new Set(completedLessonIds);
  const required = lessons.filter((l) => l.isRequired);
  const basis = required.length > 0 ? required : lessons;
  const completed = basis.filter((l) => done.has(l.id)).length;
  const total = basis.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

/** Remaining study time (minutes) from incomplete lessons with known durations. Null when no durations are recorded. */
export function remainingMinutes(
  lessons: { id: string; durationMinutes: number | null }[],
  completedLessonIds: Iterable<string>,
): number | null {
  if (!lessons.some((l) => l.durationMinutes != null)) return null;
  const done = new Set(completedLessonIds);
  return lessons.filter((l) => !done.has(l.id)).reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
}
