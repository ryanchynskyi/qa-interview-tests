import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CheckAnswerWithProgress, PlayerProgress, ProgressUpdate } from '@qa-hub/shared';
import { loadContent } from '@qa-hub/content';
import { signAccessToken } from '../src/auth/tokens';
import { JWT_SECRET, makeApp, register, testClock, TEST_URL, type TestApp } from './helpers';

const content = loadContent();
const sql = content.questions.filter((q) => q.sectionId === 'sql');
const cardIds = content.recallCards.map((c) => c.id);
const H = 3_600_000;

describe.skipIf(!TEST_URL)('server-side progress', () => {
  const clock = testClock('2026-10-10T07:00:00Z'); // 10:00 in Kyiv
  let app: TestApp;
  beforeAll(async () => {
    app = await makeApp(clock.now);
  });
  afterAll(() => app.close());

  /** Fresh user; `headers()` signs a token valid at the current (moving) test time. */
  async function user() {
    const r = await register(app);
    const headers = async () => ({
      authorization: `Bearer ${await signAccessToken(r.user.id, JWT_SECRET, clock.now())}`,
    });
    const call = async (method: 'GET' | 'POST', url: string, payload?: object) =>
      app.inject({ method, url, payload, headers: await headers() });
    return {
      id: r.user.id,
      progress: async () => (await call('GET', '/me/progress')).json<PlayerProgress>(),
      answer: async (questionId: string, choice: number | null) =>
        (await call('POST', '/quiz/check', { questionId, choice })).json<CheckAnswerWithProgress>(),
      finish: (sectionId: string, questionIds: string[]) =>
        call('POST', '/me/quiz/finish', { sectionId, questionIds }),
      rate: async (cardId: string, rating: number) =>
        (await call('POST', '/me/recall/rate', { cardId, rating })).json<ProgressUpdate>(),
      read: (articleId: string) =>
        call('POST', `/me/articles/${encodeURIComponent(articleId)}/read`),
      reset: (sectionId: string) => call('POST', `/me/sections/${sectionId}/reset`),
    };
  }

  it('requires a token', async () => {
    expect((await app.inject({ method: 'GET', url: '/me/progress' })).statusCode).toBe(401);
  });

  it('starts empty with three daily tasks for the local day', async () => {
    const u = await user();
    const p = await u.progress();
    expect(p).toMatchObject({
      timeZone: 'Europe/Kyiv',
      questions: {},
      cards: {},
      stats: { totalXp: 0 },
    });
    expect(p.daily?.date).toBe('2026-10-10');
    expect(p.daily?.tasks).toHaveLength(3);
    // Same set on a second read: generated once per day.
    expect((await u.progress()).daily).toEqual(p.daily);
  });

  it('records answers checked by /quiz/check and grants XP once', async () => {
    const u = await user();
    const q = sql[0]!;
    const first = await u.answer(q.id, q.correctIndex);
    expect(first.outcome).toBe('correct');
    expect(first.progress?.question).toEqual({
      id: q.id,
      state: expect.objectContaining({ lastResult: 1, attempts: 1 }),
    });
    expect(first.progress?.result.grants[0]).toMatchObject({
      reason: 'answer_first_correct',
      refId: q.id,
    });

    const again = await u.answer(q.id, q.correctIndex);
    expect(again.progress?.result.grants).toEqual([]); // same local day

    const p = await u.progress();
    expect(p.questions[q.id]).toMatchObject({ lastResult: 1, attempts: 2 });
    expect(p.stats.totalXp).toBe(first.progress!.result.xpGained);
    expect(p.xpLog.map((g) => g.reason)).toContain('answer_first_correct');
  });

  it('keeps guests stateless: no token, no progress in the response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/quiz/check',
      payload: { questionId: sql[0]!.id, choice: 0 },
    });
    expect(res.json()).not.toHaveProperty('progress');
  });

  describe('finishing a quiz', () => {
    it('counts correct answers itself and grants the bonus once', async () => {
      const u = await user();
      const run = sql.slice(0, 10);
      for (const [i, q] of run.entries()) {
        await u.answer(q.id, i < 8 ? q.correctIndex : (q.correctIndex + 1) % q.options.length);
      }
      const res = await u.finish(
        'sql',
        run.map((q) => q.id),
      );
      expect(res.statusCode).toBe(200);
      const body = res.json<ProgressUpdate>();
      expect(body.attempt?.attempt).toMatchObject({ n: 10, y: 8 });
      expect(body.result.grants.some((g) => g.reason === 'quiz_bonus')).toBe(true);

      const dup = await u.finish(
        'sql',
        run.map((q) => q.id),
      );
      expect(dup.statusCode).toBe(409);
      expect(dup.json()).toMatchObject({ error: 'already_finished' });
    });

    it('refuses runs with unanswered, stale or foreign questions', async () => {
      const u = await user();
      const [a, b] = sql;
      await u.answer(a!.id, a!.correctIndex);
      expect((await u.finish('sql', [a!.id, b!.id])).json()).toMatchObject({
        error: 'not_answered',
      });

      const api = content.questions.find((q) => q.sectionId === 'api')!;
      expect((await u.finish('sql', [a!.id, api.id])).statusCode).toBe(400);

      clock.advance(7 * H);
      expect((await u.finish('sql', [a!.id])).json()).toMatchObject({ error: 'not_answered' });
    });
  });

  it('schedules recall cards and grants XP only when due', async () => {
    const u = await user();
    const first = await u.rate(cardIds[0]!, 4);
    expect(first.card?.state).toMatchObject({ rating: 4, reviews: 1 });
    expect(first.result.grants[0]).toMatchObject({ reason: 'recall', amount: 5 });
    const early = await u.rate(cardIds[0]!, 5);
    expect(early.result.grants).toEqual([]);
    expect((await u.progress()).cards[cardIds[0]!]).toMatchObject({ rating: 5, reviews: 2 });
  });

  it('grants article XP once and 404s unknown articles', async () => {
    const u = await user();
    const id = content.articles[0]!.id;
    const a = (await u.read(id)).json<ProgressUpdate>();
    const b = (await u.read(id)).json<ProgressUpdate>();
    expect(a.result.grants[0]).toMatchObject({ reason: 'article_read', amount: 2 });
    expect(b.result.grants).toEqual([]);
    expect((await u.read('nope:0')).statusCode).toBe(404);
  });

  it('serialises parallel requests: concurrent first answers grant XP exactly once', async () => {
    const u = await user();
    const q = sql[1]!;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => u.answer(q.id, q.correctIndex)),
    );
    const granted = results.filter((r) => r.progress!.result.grants.length > 0);
    expect(granted).toHaveLength(1);
    const p = await u.progress();
    expect(p.questions[q.id]?.attempts).toBe(5);
    expect(p.stats.totalXp).toBe(granted[0]!.progress!.result.xpGained);
  });

  it('rolls daily tasks over at local midnight and keeps the streak', async () => {
    clock.set('2026-10-10T20:50:00Z'); // 23:50 in Kyiv
    const u = await user();
    const day1 = await u.progress();
    expect(day1.daily?.date).toBe('2026-10-10');

    // A new user gets 3 of {ANSWER_N, ACCURACY, CODE_REVIEW, READ_ARTICLE}: complete
    // whichever of the easy ones was generated.
    const tasks = day1.daily!.tasks;
    const read = tasks.find((t) => t.type === 'READ_ARTICLE');
    const answerN = tasks.find((t) => t.type === 'ANSWER_N');
    if (read) {
      await u.read(content.articles.find((x) => x.chapterId === read.params.chapterId)!.id);
    } else if (answerN) {
      const topic = answerN.params.topicId;
      const pool = content.questions.filter(
        (q) => !topic || content.sections.find((s) => s.id === q.sectionId)!.topicId === topic,
      );
      for (const q of pool.slice(0, answerN.target)) await u.answer(q.id, q.correctIndex);
    } else {
      for (const q of content.questions.filter((x) => x.sectionId === 'pwfix').slice(0, 3)) {
        await u.answer(q.id, q.correctIndex);
      }
    }
    const afterDay1 = await u.progress();
    expect(afterDay1.daily!.tasks.some((t) => t.completedAt !== null)).toBe(true);
    expect(afterDay1.stats).toMatchObject({ streak: 1, lastActiveDate: '2026-10-10' });

    clock.set('2026-10-10T21:05:00Z'); // 00:05 on the 11th in Kyiv
    const day2 = await u.progress();
    expect(day2.daily?.date).toBe('2026-10-11');
    expect(day2.daily!.tasks.every((t) => t.progress === 0)).toBe(true);
    expect(day2.stats.streak).toBe(1); // still alive until a whole day is missed
  });

  it('resets a section without touching XP', async () => {
    const u = await user();
    const q = sql[2]!;
    await u.answer(q.id, q.correctIndex);
    const xp = (await u.progress()).stats.totalXp;
    expect((await u.reset('sql')).statusCode).toBe(204);
    const p = await u.progress();
    expect(p.questions).toEqual({});
    expect(p.stats.totalXp).toBe(xp);
  });

  it('keeps users apart', async () => {
    const a = await user();
    const b = await user();
    await a.answer(sql[3]!.id, sql[3]!.correctIndex);
    expect((await b.progress()).questions).toEqual({});
  });
});
