import { describe, expect, it, vi } from 'vitest';
import type { PlayerProgress, ProgressUpdate, QuizQuestion } from '@qa-hub/shared';
import { ServerStore } from './server-store';

const empty = (): PlayerProgress => ({
  timeZone: 'Europe/Kyiv',
  questions: {},
  cards: {},
  articlesRead: {},
  attempts: {},
  stats: { totalXp: 0, streak: 0, longestStreak: 0, lastActiveDate: null },
  daily: { date: '2026-10-10', tasks: [] },
  xpLog: [],
});

const update = (over: Partial<ProgressUpdate> = {}, xp = 10): ProgressUpdate => ({
  at: 1000,
  result: {
    stats: { totalXp: xp, streak: 0, longestStreak: 0, lastActiveDate: null },
    daily: { date: '2026-10-10', tasks: [] },
    grants: xp ? [{ amount: xp, reason: 'answer_first_correct', refId: 'q1' }] : [],
    xpGained: xp,
    levelUp: null,
    completedTasks: [],
  },
  ...over,
});

const q: QuizQuestion = {
  id: 'q1',
  sectionId: 'sql',
  chapterId: 'sq-0',
  group: 'g',
  level: 'middle',
  text: '?',
  code: '',
  options: ['a', 'b'],
};

function setup(now = Date.parse('2026-10-10T08:00:00Z')) {
  const api = {
    progress: vi.fn(async () => empty()),
    checkAnswer: vi.fn(async () => ({
      outcome: 'correct' as const,
      correctIndex: 0,
      explanation: 'e',
      progress: update({
        question: {
          id: 'q1',
          state: { lastResult: 1, attempts: 1, firstCorrectAt: 1, lastXpDate: '2026-10-10' },
        },
      }),
    })),
    finishQuiz: vi.fn(async () =>
      update({ attempt: { sectionId: 'sql', attempt: { at: 2000, n: 10, y: 9 } } }, 20),
    ),
    rateCard: vi.fn(async () =>
      update(
        { card: { id: 'c1', state: { rating: 4, reviews: 1, dueAt: 9e12, history: [4] } } },
        5,
      ),
    ),
    readArticle: vi.fn(async () => update({ articleRead: { id: 'a1', at: 1000 } }, 2)),
    resetSection: vi.fn(async () => undefined),
    importProgress: vi.fn(async () => ({
      imported: { questions: 1, cards: 0, articles: 0, attempts: 0 },
      skipped: { questions: 0, cards: 0, articles: 0, attempts: 0 },
      xpGained: 10,
      levelUp: null,
    })),
  };
  let t = now;
  const store = new ServerStore({
    api,
    user: { id: 'u1', email: 'e@x', displayName: 'E', timeZone: 'Europe/Kyiv' },
    now: () => t,
  });
  return { store, api, setNow: (iso: string) => void (t = Date.parse(iso)) };
}

describe('ServerStore', () => {
  it('loads the server snapshot', async () => {
    const { store } = setup();
    expect(store.ready).toBe(false);
    await store.load();
    expect(store.getSnapshot()).toMatchObject({ guestId: 'u1', stats: { totalXp: 0 } });
  });

  it('patches answers, cards, articles and attempts from responses', async () => {
    const { store } = setup();
    await store.load();
    const { check, result } = await store.answer(q, 'sql', 0);
    expect(check).toEqual({ outcome: 'correct', correctIndex: 0, explanation: 'e' });
    expect(result.xpGained).toBe(10);
    expect(store.getSnapshot().questions.q1).toMatchObject({ lastResult: 1 });

    expect((await store.rate({ id: 'c1', topicId: 'sql', chapterId: 'sq-0' }, 4)).wasDue).toBe(
      true,
    );
    expect(store.getSnapshot().cards.c1).toMatchObject({ rating: 4 });

    await store.readArticle('a1');
    expect(store.getSnapshot().articlesRead).toEqual({ a1: 1000 });

    await store.finishQuiz('sql', ['q1']);
    expect(store.getSnapshot().attempts.sql).toEqual([{ at: 2000, n: 10, y: 9 }]);
    expect(store.getSnapshot().xpLog.map((g) => g.amount)).toEqual([10, 5, 2, 20]);
    expect(store.getSnapshot().stats.totalXp).toBe(20); // server's totals win
  });

  it('refuses to record an answer the server did not attribute to the user', async () => {
    const { store, api } = setup();
    await store.load();
    api.checkAnswer.mockResolvedValueOnce({
      outcome: 'correct',
      correctIndex: 0,
      explanation: 'e',
    } as never);
    await expect(store.answer(q, 'sql', 0)).rejects.toThrow();
  });

  it('reloads when a new local day starts', async () => {
    const { store, api, setNow } = setup();
    await store.load();
    store.refreshDaily();
    expect(api.progress).toHaveBeenCalledTimes(1);
    setNow('2026-10-10T21:30:00Z'); // 00:30 on the 11th in Kyiv
    store.refreshDaily();
    expect(api.progress).toHaveBeenCalledTimes(2);
  });

  it('clears a section locally after the server does', async () => {
    const { store, api } = setup();
    await store.load();
    await store.answer(q, 'sql', 0);
    await store.resetSection('sql', ['q1']);
    expect(api.resetSection).toHaveBeenCalledWith('sql');
    expect(store.getSnapshot().questions).toEqual({});
  });

  it('reloads the snapshot after an import that added something', async () => {
    const { store, api } = setup();
    await store.load();
    const r = await store.importProgress({
      source: 'guest',
      questions: {},
      cards: {},
      articlesRead: {},
      attempts: {},
    });
    expect(r.xpGained).toBe(10);
    expect(api.progress).toHaveBeenCalledTimes(2);
  });
});
