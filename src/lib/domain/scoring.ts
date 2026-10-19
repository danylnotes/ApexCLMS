export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";

export interface ScorableQuestion {
  id: string;
  type: QuestionType;
  points: number;
  correctOptionId?: string | null;
  correctBoolean?: boolean | null;
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOptionId?: string | null;
  booleanAnswer?: boolean | null;
  textAnswer?: string | null;
}

export interface ScoredResponse {
  questionId: string;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
}

export interface ScoreResult {
  responses: ScoredResponse[];
  score: number;
  maxScore: number;
  /** Null while any response awaits manual review. */
  percent: number | null;
  needsReview: boolean;
}

/** Automatically scores objective questions. Short answers are left for instructor review. */
export function scoreAttempt(questions: ScorableQuestion[], answers: SubmittedAnswer[]): ScoreResult {
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  let score = 0;
  let maxScore = 0;
  let needsReview = false;
  const responses: ScoredResponse[] = questions.map((q) => {
    maxScore += q.points;
    const a = byQ.get(q.id);
    if (q.type === "SHORT_ANSWER") {
      if (!a?.textAnswer?.trim()) return { questionId: q.id, isCorrect: false, pointsAwarded: 0 };
      needsReview = true;
      return { questionId: q.id, isCorrect: null, pointsAwarded: null };
    }
    let correct = false;
    if (q.type === "MULTIPLE_CHOICE") correct = !!a?.selectedOptionId && a.selectedOptionId === q.correctOptionId;
    if (q.type === "TRUE_FALSE") correct = a?.booleanAnswer != null && a.booleanAnswer === q.correctBoolean;
    const pts = correct ? q.points : 0;
    score += pts;
    return { questionId: q.id, isCorrect: correct, pointsAwarded: pts };
  });
  return {
    responses,
    score,
    maxScore,
    percent: needsReview ? null : percentOf(score, maxScore),
    needsReview,
  };
}

export function percentOf(score: number, max: number): number {
  return max === 0 ? 0 : Math.round((score / max) * 100);
}

export function isPass(percent: number, passingScore: number): boolean {
  return percent >= passingScore;
}

export interface AttemptEligibility {
  allowed: boolean;
  reason?: string;
}

export function attemptEligibility(opts: {
  attemptsUsed: number;
  maxAttempts: number;
  alreadyPassed: boolean;
  pendingReview: boolean;
}): AttemptEligibility {
  if (opts.alreadyPassed) return { allowed: false, reason: "You have already passed this assessment." };
  if (opts.pendingReview) return { allowed: false, reason: "Your previous attempt is awaiting instructor review." };
  if (opts.maxAttempts > 0 && opts.attemptsUsed >= opts.maxAttempts)
    return { allowed: false, reason: `The maximum of ${opts.maxAttempts} attempts has been reached.` };
  return { allowed: true };
}
