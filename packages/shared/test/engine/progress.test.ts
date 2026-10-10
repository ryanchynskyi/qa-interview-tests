import { describe, expect, it } from 'vitest';
import type { DailyTask } from '../../src/engine/daily-tasks';
import type { ActivityEvent } from '../../src/engine/events';
import { xpAtLevel } from '../../src/engine/levels';
import {
  advanceStreak,
  currentStreak,
  ensureDaily,
  newPlayerStats,
  recordActivity,
  type DailyState,
  type PlayerStats,
} from '../../src/engine/progress';
import { localDate } from '../../src/engine/time';

const tz = 'Europe/Kyiv';
const at = (iso: string) => Date.parse(iso);

function tasksFor(date: string, targets = [1, 2, 1]): DailyTask[] {
  return targets.map((target, slot) => ({
    id: `${date}:${slot}`,
    date,
    slot,
    type: 'ANSWER_N',
    params: {},
    target,
    progress: 0,
    rewardXp: 30,
    completedAt: null,
  }));
}

const answerAt = (iso: string): ActivityEvent => ({
  type: 'answer',
  at: at(iso),
  questionId: 'q',
  sectionId: 'sql',
  topicId: 'sql',
  chapterId: 'sq-0',
  outcome: 'correct',
});

/** Simulates a day: ensure tasks, then record `n` answers spaced a minute apart. */
function playDay(stats: PlayerStats, daily: DailyState | null, iso: string, n: number) {
  const start = at(iso);
  daily = ensureDaily(daily, localDate(start, tz), (d) => tasksFor(d));
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = recordActivity({
      stats,
      daily,
      event: { ...answerAt(iso), at: start + i * 60_000 },
      itemGrants: [{ amount: 5, reason: 'answer_first_correct', refId: `q${i}` }],
      timeZone: tz,
    });
    stats = r.stats;
    daily = r.daily;
    results.push(r);
  }
  return { stats, daily: daily!, results };
}

describe('ensureDaily', () => {
  const gen = (d: string) => tasksFor(d);

  it('creates tasks for a new day and keeps them for the same day', () => {
    const first = ensureDaily(null, '2026-10-10', gen);
    expect(first.date).toBe('2026-10-10');
    expect(ensureDaily(first, '2026-10-10', () => [])).toBe(first);
    expect(ensureDaily(first, '2026-10-11', gen).date).toBe('2026-10-11');
  });

  it('never goes back to an earlier date (time-zone switching cannot farm tasks)', () => {
    const today = ensureDaily(null, '2026-10-10', gen);
    expect(ensureDaily(today, '2026-10-09', () => [])).toBe(today);
  });
});

describe('streaks', () => {
  it('grows on consecutive days, resets after a gap, and tracks the longest', () => {
    let s = newPlayerStats();
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) s = advanceStreak(s, d).stats;
    expect(s).toMatchObject({ streak: 3, longestStreak: 3, lastActiveDate: '2026-10-03' });

    const same = advanceStreak(s, '2026-10-03');
    expect(same.grew).toBe(false);
    expect(same.stats).toBe(s);

    s = advanceStreak(s, '2026-10-05').stats;
    expect(s).toMatchObject({ streak: 1, longestStreak: 3 });
  });

  it('shows 0 once a full day was missed', () => {
    const s = { ...newPlayerStats(), streak: 4, longestStreak: 4, lastActiveDate: '2026-10-10' };
    expect(currentStreak(s, '2026-10-10')).toBe(4);
    expect(currentStreak(s, '2026-10-11')).toBe(4); // still time today to keep it
    expect(currentStreak(s, '2026-10-12')).toBe(0);
    expect(currentStreak(newPlayerStats(), '2026-10-12')).toBe(0);
  });
});

describe('recordActivity', () => {
  it('adds item XP even without daily tasks', () => {
    const r = recordActivity({
      stats: newPlayerStats(),
      daily: null,
      event: answerAt('2026-10-10T08:00:00Z'),
      itemGrants: [{ amount: 10, reason: 'answer_first_correct', refId: 'q' }],
      timeZone: tz,
    });
    expect(r).toMatchObject({ xpGained: 10, completedTasks: [], levelUp: null });
    expect(r.stats.totalXp).toBe(10);
  });

  it('completes tasks, then grants all-done and streak bonuses exactly once', () => {
    // Targets 1, 2, 1: the 1st answer completes slots 0 and 2, the 2nd completes slot 1.
    const { stats, daily, results } = playDay(newPlayerStats(), null, '2026-10-10T08:00:00Z', 3);
    const [r1, r2, r3] = results;

    expect(r1!.completedTasks.map((t) => t.slot)).toEqual([0, 2]);
    expect(r1!.grants.map((g) => [g.reason, g.amount])).toEqual([
      ['answer_first_correct', 5],
      ['daily_task', 30],
      ['daily_task', 30],
      ['streak', 10],
    ]);
    expect(r2!.grants.map((g) => [g.reason, g.amount])).toEqual([
      ['answer_first_correct', 5],
      ['daily_task', 30],
      ['daily_all_done', 50],
    ]);
    expect(r3!.grants.map((g) => g.reason)).toEqual(['answer_first_correct']);

    expect(daily.tasks.every((t) => t.completedAt !== null)).toBe(true);
    expect(stats).toMatchObject({ totalXp: 5 * 3 + 30 * 3 + 50 + 10, streak: 1 });
  });

  it('ignores tasks from another local day', () => {
    const daily: DailyState = { date: '2026-10-09', tasks: tasksFor('2026-10-09') };
    const r = recordActivity({
      stats: newPlayerStats(),
      daily,
      event: answerAt('2026-10-10T08:00:00Z'),
      itemGrants: [],
      timeZone: tz,
    });
    expect(r.completedTasks).toEqual([]);
    expect(r.daily).toBe(daily);
  });

  it('attributes events to the local day: 23:59 and 00:01 in Kyiv are different days', () => {
    let s = newPlayerStats();
    let d: DailyState | null = null;
    ({ stats: s, daily: d } = playDay(s, d, '2026-10-10T20:59:00Z', 1)); // 23:59 on the 10th
    ({ stats: s, daily: d } = playDay(s, d, '2026-10-10T21:01:00Z', 1)); // 00:01 on the 11th
    expect(d.date).toBe('2026-10-11');
    expect(s).toMatchObject({ streak: 2, lastActiveDate: '2026-10-11' });
  });

  it('builds a 7-day streak and caps the bonus', () => {
    let s = newPlayerStats();
    let d: DailyState | null = null;
    const streakXp: number[] = [];
    for (let day = 1; day <= 9; day++) {
      const iso = `2026-10-${String(day).padStart(2, '0')}T09:00:00Z`;
      const played = playDay(s, d, iso, 1);
      ({ stats: s, daily: d } = played);
      streakXp.push(played.results[0]!.grants.find((g) => g.reason === 'streak')!.amount);
    }
    expect(s.streak).toBe(9);
    expect(streakXp).toEqual([10, 20, 30, 40, 50, 60, 70, 70, 70]);
  });

  it('reports level-ups', () => {
    const stats = { ...newPlayerStats(), totalXp: xpAtLevel(2) - 1 };
    const r = recordActivity({
      stats,
      daily: null,
      event: answerAt('2026-10-10T08:00:00Z'),
      itemGrants: [{ amount: 300, reason: 'answer_first_correct' }],
      timeZone: tz,
    });
    expect(r.levelUp).toEqual({ from: 1, to: 3 });
  });
});
