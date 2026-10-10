/**
 * Per-item progress: what one answer, recall rating or article read does to that
 * item's stored state and how much XP it earns. The server and the guest store both
 * persist the returned `next` state and the grants.
 */
import type { Level } from '../content';
import { localDate, type LocalDate } from './time';
import { XP_RULES, type XpGrant } from './xp';

export interface Clock {
  now: number;
  timeZone: string;
}

/* ---------- quiz questions ---------- */

export interface QuestionProgress {
  /** Latest result; a skip counts as 0, like the legacy app. */
  lastResult: 0 | 1;
  attempts: number;
  firstCorrectAt: number | null;
  /** Local date of the last XP grant, to allow one repeat grant per day. */
  lastXpDate: LocalDate | null;
}

export type AnswerOutcome = 'correct' | 'wrong' | 'skipped';

export function applyAnswer(
  prev: QuestionProgress | undefined,
  answer: { questionId: string; level: Level; outcome: AnswerOutcome },
  clock: Clock,
): { next: QuestionProgress; grants: XpGrant[] } {
  const today = localDate(clock.now, clock.timeZone);
  const correct = answer.outcome === 'correct';
  const next: QuestionProgress = {
    lastResult: correct ? 1 : 0,
    attempts: (prev?.attempts ?? 0) + 1,
    firstCorrectAt: prev?.firstCorrectAt ?? null,
    lastXpDate: prev?.lastXpDate ?? null,
  };
  const grants: XpGrant[] = [];
  if (correct) {
    if (next.firstCorrectAt === null) {
      next.firstCorrectAt = clock.now;
      grants.push({
        amount: XP_RULES.firstCorrect[answer.level],
        reason: 'answer_first_correct',
        refId: answer.questionId,
      });
    } else if (next.lastXpDate !== today) {
      grants.push({
        amount: XP_RULES.repeatCorrect,
        reason: 'answer_repeat',
        refId: answer.questionId,
      });
    }
    if (grants.length) next.lastXpDate = today;
  }
  return { next, grants };
}

/* ---------- recall cards ---------- */

/** Days until a card is due again, indexed by rating 1..5 (legacy INTERVAL). */
export const RECALL_INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;
const DAY_MS = 86_400_000;
const HISTORY = 5;

export interface CardProgress {
  rating: number;
  reviews: number;
  dueAt: number;
  /** Last ratings, newest last. */
  history: number[];
}

export const isCardDue = (card: CardProgress | undefined, now: number): boolean =>
  !!card && card.dueAt <= now;

export function applyRecall(
  prev: CardProgress | undefined,
  rating: number,
  cardId: string,
  clock: Clock,
): { next: CardProgress; wasDue: boolean; grants: XpGrant[] } {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new RangeError(`Recall rating must be 1..5, got ${rating}`);
  }
  // A card seen for the first time counts as due: first reviews earn XP too.
  const wasDue = !prev || prev.dueAt <= clock.now;
  const next: CardProgress = {
    rating,
    reviews: (prev?.reviews ?? 0) + 1,
    dueAt: clock.now + RECALL_INTERVAL_DAYS[rating - 1]! * DAY_MS,
    history: [...(prev?.history ?? []), rating].slice(-HISTORY),
  };
  const grants: XpGrant[] = wasDue
    ? [
        {
          amount: rating >= 4 ? XP_RULES.recallDueGood : XP_RULES.recallDue,
          reason: 'recall',
          refId: cardId,
        },
      ]
    : [];
  return { next, wasDue, grants };
}

/* ---------- knowledge base ---------- */

export function applyArticleRead(alreadyRead: boolean, articleId: string): XpGrant[] {
  return alreadyRead
    ? []
    : [{ amount: XP_RULES.articleFirstRead, reason: 'article_read', refId: articleId }];
}
