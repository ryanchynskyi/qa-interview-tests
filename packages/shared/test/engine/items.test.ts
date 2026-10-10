import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  applyArticleRead,
  applyRecall,
  isCardDue,
  type QuestionProgress,
} from '../../src/engine/items';
import { quizBonus, streakBonus } from '../../src/engine/xp';

const tz = 'Europe/Kyiv';
const at = (iso: string) => ({ now: Date.parse(iso), timeZone: tz });
const DAY = 86_400_000;

describe('applyAnswer', () => {
  const q = { questionId: 'q1', level: 'middle' as const };

  it('grants first-correct XP by level, once', () => {
    const first = applyAnswer(undefined, { ...q, outcome: 'correct' }, at('2026-10-10T08:00:00Z'));
    expect(first.grants).toEqual([{ amount: 10, reason: 'answer_first_correct', refId: 'q1' }]);
    expect(first.next).toMatchObject({ lastResult: 1, attempts: 1, lastXpDate: '2026-10-10' });

    const again = applyAnswer(first.next, { ...q, outcome: 'correct' }, at('2026-10-10T09:00:00Z'));
    expect(again.grants).toEqual([]); // repeat XP already used today (by the first grant)
  });

  it('grants 1 XP for a repeat correct answer on a later local day', () => {
    const first = applyAnswer(undefined, { ...q, outcome: 'correct' }, at('2026-10-10T08:00:00Z'));
    const nextDay = applyAnswer(
      first.next,
      { ...q, outcome: 'correct' },
      at('2026-10-11T08:00:00Z'),
    );
    expect(nextDay.grants).toEqual([{ amount: 1, reason: 'answer_repeat', refId: 'q1' }]);
    const sameDay = applyAnswer(
      nextDay.next,
      { ...q, outcome: 'correct' },
      at('2026-10-11T10:00:00Z'),
    );
    expect(sameDay.grants).toEqual([]);
  });

  it('uses the local day: 23:30 and 00:30 Kyiv time are different days', () => {
    const first = applyAnswer(undefined, { ...q, outcome: 'correct' }, at('2026-10-10T20:30:00Z'));
    const after = applyAnswer(first.next, { ...q, outcome: 'correct' }, at('2026-10-10T21:30:00Z'));
    expect(after.grants).toHaveLength(1);
  });

  it('gives nothing for wrong or skipped, and records them as 0', () => {
    for (const outcome of ['wrong', 'skipped'] as const) {
      const r = applyAnswer(undefined, { ...q, outcome }, at('2026-10-10T08:00:00Z'));
      expect(r.grants).toEqual([]);
      expect(r.next).toMatchObject({ lastResult: 0, firstCorrectAt: null });
    }
  });

  it('still grants first-correct XP after earlier wrong answers', () => {
    const wrong = applyAnswer(undefined, { ...q, outcome: 'wrong' }, at('2026-10-10T08:00:00Z'));
    const right = applyAnswer(wrong.next, { ...q, outcome: 'correct' }, at('2026-10-10T08:01:00Z'));
    expect(right.grants[0]?.reason).toBe('answer_first_correct');
    expect(right.next.attempts).toBe(2);
  });

  it('does not mutate the previous state', () => {
    const prev: QuestionProgress = {
      lastResult: 0,
      attempts: 1,
      firstCorrectAt: null,
      lastXpDate: null,
    };
    const copy = structuredClone(prev);
    applyAnswer(prev, { ...q, outcome: 'correct' }, at('2026-10-10T08:00:00Z'));
    expect(prev).toEqual(copy);
  });
});

describe('applyRecall', () => {
  const now = Date.parse('2026-10-10T08:00:00Z');
  const clock = { now, timeZone: tz };

  it('schedules with the legacy intervals 0/1/3/7/14 days', () => {
    expect(
      [1, 2, 3, 4, 5].map((r) => applyRecall(undefined, r, 'c', clock).next.dueAt - now),
    ).toEqual([0, 1, 3, 7, 14].map((d) => d * DAY));
  });

  it('treats a new card as due and grants 3 or 5 XP', () => {
    expect(applyRecall(undefined, 3, 'c', clock)).toMatchObject({
      wasDue: true,
      grants: [{ amount: 3, reason: 'recall', refId: 'c' }],
    });
    expect(applyRecall(undefined, 4, 'c', clock).grants[0]?.amount).toBe(5);
  });

  it('grants nothing when reviewing before the card is due', () => {
    const first = applyRecall(undefined, 5, 'c', clock);
    const early = applyRecall(first.next, 5, 'c', { now: now + DAY, timeZone: tz });
    expect(early.wasDue).toBe(false);
    expect(early.grants).toEqual([]);
    expect(early.next.reviews).toBe(2);
  });

  it('keeps the last five ratings', () => {
    let card = applyRecall(undefined, 1, 'c', clock).next;
    for (const r of [2, 3, 4, 5, 1]) card = applyRecall(card, r, 'c', clock).next;
    expect(card.history).toEqual([2, 3, 4, 5, 1]);
  });

  it('rejects ratings outside 1..5', () => {
    expect(() => applyRecall(undefined, 0, 'c', clock)).toThrow(RangeError);
    expect(() => applyRecall(undefined, 6, 'c', clock)).toThrow(RangeError);
    expect(() => applyRecall(undefined, 2.5, 'c', clock)).toThrow(RangeError);
  });

  it('reports due cards', () => {
    const card = applyRecall(undefined, 2, 'c', clock).next;
    expect(isCardDue(card, now)).toBe(false);
    expect(isCardDue(card, now + DAY)).toBe(true);
    expect(isCardDue(undefined, now)).toBe(false);
  });
});

describe('other XP rules', () => {
  it('grants article XP only on the first read', () => {
    expect(applyArticleRead(false, 'a')).toEqual([
      { amount: 2, reason: 'article_read', refId: 'a' },
    ]);
    expect(applyArticleRead(true, 'a')).toEqual([]);
  });

  it('grants the quiz bonus for ≥10 answers at ≥80%', () => {
    expect(quizBonus(10, 8)).toEqual([{ amount: 20, reason: 'quiz_bonus' }]);
    expect(quizBonus(10, 7)).toEqual([]);
    expect(quizBonus(5, 5)).toEqual([]);
  });

  it('caps the streak bonus at 7 days', () => {
    expect(streakBonus(1).amount).toBe(10);
    expect(streakBonus(7).amount).toBe(70);
    expect(streakBonus(30).amount).toBe(70);
  });
});
