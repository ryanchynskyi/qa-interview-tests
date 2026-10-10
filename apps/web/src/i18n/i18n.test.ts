import { describe, expect, it } from 'vitest';
import type { Catalog, DailyTask } from '@qa-hub/shared';
import { describeTask } from '../lib/tasks';
import { en } from './en';
import { plural } from './index';
import { uk } from './uk';

/** Same keys, same array lengths, same value kinds; text itself is free to differ. */
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shape);
  if (typeof v === 'function') return 'fn';
  if (v && typeof v === 'object' && !('$$typeof' in v)) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, shape((v as Record<string, unknown>)[k])]),
    );
  }
  return typeof v;
}

describe('messages', () => {
  it('English has exactly the shape of Ukrainian', () => {
    expect(shape(en)).toEqual(shape(uk));
  });

  it('picks plural forms per language', () => {
    const days = { one: 'день', few: 'дні', many: 'днів', other: 'дня' };
    expect(plural('uk', 1, days)).toBe('день');
    expect(plural('uk', 3, days)).toBe('дні');
    expect(plural('uk', 7, days)).toBe('днів');
    expect(plural('en', 1, { one: 'day', other: 'days' })).toBe('day');
    expect(plural('en', 2, { one: 'day', other: 'days' })).toBe('days');
  });

  it('describes daily tasks in the language it is given', () => {
    const catalog = { topics: [], sections: [], chapters: [], questions: [] } as unknown as Catalog;
    const task = {
      id: 't',
      type: 'REVIEW_DUE',
      target: 1,
      progress: 0,
      rewardXp: 10,
      params: {},
      completedAt: null,
    } as unknown as DailyTask;
    expect(describeTask(task, catalog, en).title).toBe('Review 1 card that is due');
    expect(describeTask(task, catalog, uk).title).toBe('Повтори 1 карток, яким пора');
  });
});
