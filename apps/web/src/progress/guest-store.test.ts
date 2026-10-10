import { describe, expect, it, vi } from 'vitest';
import type { Catalog, CheckAnswerResponse, QuizQuestion } from '@qa-hub/shared';
import { GuestStore, STORAGE_KEY, type KeyValueStorage, type ProgressState } from './guest-store';

const catalog: Catalog = {
  topics: [{ id: 'sql', name: 'SQL', order: 0 }],
  sections: [
    {
      id: 'sql',
      topicId: 'sql',
      name: 'SQL',
      description: '',
      order: 0,
      questionCount: 2,
      codeReview: false,
    },
  ],
  chapters: [
    { id: 'sq-0', topicId: 'sql', title: 'Основи', subtitle: '', order: 0, articleCount: 2 },
  ],
  questions: [
    { id: 'q1', sectionId: 'sql', chapterId: 'sq-0', group: 'Основи', level: 'middle' },
    { id: 'q2', sectionId: 'sql', chapterId: 'sq-0', group: 'Основи', level: 'senior' },
  ],
  recallCards: [{ id: 'c1', topicId: 'sql', chapterId: 'sq-0' }],
};

const question = (id: string, level: 'middle' | 'senior' = 'middle'): QuizQuestion => ({
  id,
  sectionId: 'sql',
  chapterId: 'sq-0',
  group: 'Основи',
  level,
  text: '?',
  code: '',
  options: ['a', 'b', 'c', 'd'],
});

function memoryStorage(
  initial: Record<string, string> = {},
): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function setup(opts: { storage?: ReturnType<typeof memoryStorage>; iso?: string } = {}) {
  const storage = opts.storage ?? memoryStorage();
  let now = Date.parse(opts.iso ?? '2026-10-10T08:00:00Z');
  const checkAnswer = vi.fn(
    async ({ choice }: { choice: number | null }): Promise<CheckAnswerResponse> => ({
      outcome: choice === null ? 'skipped' : choice === 0 ? 'correct' : 'wrong',
      correctIndex: 0,
      explanation: 'because',
    }),
  );
  const store = new GuestStore({
    storage,
    checkAnswer,
    now: () => now,
    timeZone: () => 'Europe/Kyiv',
    newId: () => 'guest-1',
  });
  return {
    store,
    storage,
    checkAnswer,
    advance: (ms: number) => void (now += ms),
    saved: () => JSON.parse(storage.data[STORAGE_KEY]!) as ProgressState,
  };
}

describe('GuestStore', () => {
  it("starts empty and creates today's tasks once the catalog arrives", () => {
    const { store } = setup();
    expect(store.getSnapshot()).toMatchObject({
      guestId: 'guest-1',
      daily: null,
      stats: { totalXp: 0 },
    });
    store.setCatalog(catalog);
    expect(store.getSnapshot().daily).toMatchObject({ date: '2026-10-10' });
    expect(store.getSnapshot().daily!.tasks).toHaveLength(3);
  });

  it('checks answers on the server, then records progress and XP', async () => {
    const { store, checkAnswer, saved } = setup();
    store.setCatalog(catalog);
    const { check, result } = await store.answer(question('q1'), 'sql', 0);

    expect(checkAnswer).toHaveBeenCalledWith({ questionId: 'q1', choice: 0 });
    expect(check.outcome).toBe('correct');
    expect(result.grants[0]).toMatchObject({ reason: 'answer_first_correct', amount: 10 });
    expect(store.getSnapshot().questions.q1).toMatchObject({ lastResult: 1, attempts: 1 });
    expect(saved().stats.totalXp).toBe(store.getSnapshot().stats.totalXp);
    expect(saved().xpLog.length).toBeGreaterThan(0);
  });

  it('does not touch progress when the check fails', async () => {
    const { store, checkAnswer } = setup();
    checkAnswer.mockRejectedValueOnce(new Error('offline'));
    await expect(store.answer(question('q1'), 'sql', 0)).rejects.toThrow('offline');
    expect(store.getSnapshot().questions).toEqual({});
  });

  it('notifies subscribers and survives a reload from storage', async () => {
    const { store, storage } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.answer(question('q2', 'senior'), 'sql', 0);
    expect(listener).toHaveBeenCalled();

    const again = setup({ storage }).store;
    expect(again.getSnapshot().questions.q2).toMatchObject({ lastResult: 1 });
    expect(again.getSnapshot().stats.totalXp).toBe(store.getSnapshot().stats.totalXp);
  });

  it('starts fresh when storage holds garbage', () => {
    const { store } = setup({ storage: memoryStorage({ [STORAGE_KEY]: '{oops' }) });
    expect(store.getSnapshot().stats.totalXp).toBe(0);
  });

  it('rates recall cards with legacy scheduling', () => {
    const { store } = setup();
    const r = store.rate({ id: 'c1', topicId: 'sql', chapterId: 'sq-0' }, 4);
    expect(r.wasDue).toBe(true);
    expect(r.grants[0]).toMatchObject({ reason: 'recall', amount: 5 });
    expect(store.getSnapshot().cards.c1).toMatchObject({ rating: 4, reviews: 1 });
  });

  it('grants article XP only for the first read', () => {
    const { store } = setup();
    expect(store.readArticle('sq-0:0', 'sq-0', 'sql').xpGained).toBe(2);
    expect(store.readArticle('sq-0:0', 'sq-0', 'sql').xpGained).toBe(0);
  });

  it('keeps quiz attempts newest first and awards the bonus', () => {
    const { store } = setup();
    store.finishQuiz('sql', 10, 9);
    const r = store.finishQuiz('sql', 10, 5);
    expect(r.grants).toEqual([]);
    expect(store.getSnapshot().attempts.sql!.map((a) => a.y)).toEqual([5, 9]);
    expect(store.getSnapshot().xpLog.some((g) => g.reason === 'quiz_bonus')).toBe(true);
  });

  it('rolls daily tasks over at local midnight', () => {
    const { store, advance } = setup({ iso: '2026-10-10T20:30:00Z' }); // 23:30 in Kyiv
    store.setCatalog(catalog);
    expect(store.getSnapshot().daily!.date).toBe('2026-10-10');
    advance(60 * 60_000); // 00:30
    store.refreshDaily();
    expect(store.getSnapshot().daily!.date).toBe('2026-10-11');
  });

  it('resets one section without losing XP', async () => {
    const { store } = setup();
    await store.answer(question('q1'), 'sql', 0);
    store.finishQuiz('sql', 1, 1);
    const xp = store.getSnapshot().stats.totalXp;
    store.resetSection('sql', ['q1', 'q2']);
    expect(store.getSnapshot().questions).toEqual({});
    expect(store.getSnapshot().attempts.sql).toBeUndefined();
    expect(store.getSnapshot().stats.totalXp).toBe(xp);
  });
});
