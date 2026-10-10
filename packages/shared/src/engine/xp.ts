import type { Level } from '../content';

/** All XP numbers in one place, so balancing never touches logic. */
export const XP_RULES = {
  firstCorrect: { junior: 5, middle: 10, senior: 15 } satisfies Record<Level, number>,
  /** A question answered correctly again: at most once per question per local day. */
  repeatCorrect: 1,
  recallDue: 3,
  recallDueGood: 5, // rating 4 or 5
  articleFirstRead: 2,
  quizBonus: 20,
  quizBonusMinAnswered: 10,
  quizBonusMinRatio: 0.8,
  dailyAllDone: 50,
  /** Streak bonus = perDay × min(streak, cap), granted when the streak grows. */
  streakPerDay: 10,
  streakCap: 7,
} as const;

export type XpReason =
  | 'answer_first_correct'
  | 'answer_repeat'
  | 'recall'
  | 'article_read'
  | 'quiz_bonus'
  | 'daily_task'
  | 'daily_all_done'
  | 'streak';

export interface XpGrant {
  amount: number;
  reason: XpReason;
  /** Question/card/article/task id the grant is for, when there is one. */
  refId?: string;
}

export const sumXp = (grants: readonly XpGrant[]): number =>
  grants.reduce((s, g) => s + g.amount, 0);

/** Bonus for finishing a quiz run with enough answers and accuracy. */
export function quizBonus(answered: number, correct: number): XpGrant[] {
  const ok =
    answered >= XP_RULES.quizBonusMinAnswered && correct / answered >= XP_RULES.quizBonusMinRatio;
  return ok ? [{ amount: XP_RULES.quizBonus, reason: 'quiz_bonus' }] : [];
}

export function streakBonus(streak: number): XpGrant {
  return {
    amount: XP_RULES.streakPerDay * Math.min(streak, XP_RULES.streakCap),
    reason: 'streak',
  };
}
