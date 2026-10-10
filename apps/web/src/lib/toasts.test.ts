import { describe, expect, it } from 'vitest';
import type { ActivityResult } from '@qa-hub/shared';
import { activityMessages } from './toasts';

const base: ActivityResult = {
  stats: { totalXp: 100, streak: 3, longestStreak: 3, lastActiveDate: '2026-10-10' },
  daily: null,
  grants: [],
  xpGained: 0,
  levelUp: null,
  completedTasks: [],
};

describe('activityMessages', () => {
  it('stays quiet for plain answer XP (shown inline already)', () => {
    expect(
      activityMessages(
        { ...base, grants: [{ amount: 10, reason: 'answer_first_correct' }], xpGained: 10 },
        undefined,
      ),
    ).toEqual([]);
  });

  it('announces tasks, all-done, streak, quiz bonus and level-ups', () => {
    const msgs = activityMessages(
      {
        ...base,
        completedTasks: [
          {
            id: 'd:0',
            date: 'd',
            slot: 0,
            type: 'REVIEW_DUE',
            params: {},
            target: 5,
            progress: 5,
            rewardXp: 30,
            completedAt: 1,
          },
        ],
        grants: [
          { amount: 50, reason: 'daily_all_done' },
          { amount: 30, reason: 'streak' },
          { amount: 20, reason: 'quiz_bonus' },
        ],
        levelUp: { from: 2, to: 3 },
      },
      undefined,
    ).map((m) => m.text);
    expect(msgs).toEqual([
      'Завдання виконано: Завдання дня · +30 XP',
      'Усі завдання на сьогодні виконано! +50 XP',
      'Серія: 3 дн. поспіль · +30 XP',
      'Бонус за точний тест · +20 XP',
      'Новий рівень 3: Junior QA!',
    ]);
  });
});
