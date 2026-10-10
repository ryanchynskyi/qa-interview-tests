import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ImportPayload, ImportResult, PlayerProgress } from '@qa-hub/shared';
import { XP_RULES } from '@qa-hub/shared';
import { loadContent } from '@qa-hub/content';
import { makeApp, register, testClock, TEST_URL, type TestApp } from './helpers';

const content = loadContent();
const [q1, q2, q3] = content.questions.filter((q) => q.sectionId === 'sql');
const [c1, c2] = content.recallCards;
const a1 = content.articles[0]!;
const DAY = 86_400_000;

describe.skipIf(!TEST_URL)('POST /me/import', () => {
  const clock = testClock('2026-10-10T07:00:00Z');
  let app: TestApp;
  beforeAll(async () => {
    app = await makeApp(clock.now);
  });
  afterAll(() => app.close());

  async function user() {
    const r = await register(app);
    const send = (payload: unknown) =>
      app.inject({
        method: 'POST',
        url: '/me/import',
        payload: payload as object,
        headers: r.auth,
      });
    const progress = async () =>
      (
        await app.inject({ method: 'GET', url: '/me/progress', headers: r.auth })
      ).json<PlayerProgress>();
    return { ...r, send, progress };
  }

  const payload = (over: Partial<ImportPayload> = {}): ImportPayload => ({
    source: 'legacy',
    questions: {
      [q1!.id]: { lastResult: 1 },
      [q2!.id]: { lastResult: 0, attempts: 3 },
      'not-a-question': { lastResult: 1 },
    },
    cards: { [c1!.id]: { rating: 5, reviews: 2, dueAt: clock.now() + 3 * DAY, history: [3, 5] } },
    articlesRead: { [a1.id]: clock.now() - DAY },
    attempts: { sql: [{ at: clock.now() - DAY, n: 10, y: 7 }] },
    ...over,
  });

  it('requires a signed-in user', async () => {
    const res = await app.inject({ method: 'POST', url: '/me/import', payload: payload() });
    expect(res.statusCode).toBe(401);
  });

  it('imports known items and recomputes XP from the normal rules', async () => {
    const u = await user();
    const res = await u.send(payload());
    expect(res.statusCode).toBe(200);
    const body = res.json<ImportResult>();
    const expected =
      XP_RULES.firstCorrect[q1!.level] + XP_RULES.recallDueGood + XP_RULES.articleFirstRead;
    expect(body).toMatchObject({
      imported: { questions: 2, cards: 1, articles: 1, attempts: 1 },
      skipped: { questions: 1, cards: 0, articles: 0, attempts: 0 },
      xpGained: expected,
    });

    const p = await u.progress();
    expect(p.questions[q1!.id]).toMatchObject({ lastResult: 1, attempts: 1 });
    expect(p.questions[q2!.id]).toMatchObject({ lastResult: 0, attempts: 3 });
    expect(p.cards[c1!.id]).toMatchObject({ rating: 5, reviews: 2, history: [3, 5] });
    expect(p.articlesRead[a1.id]).toBe(clock.now() - DAY);
    expect(p.attempts.sql).toEqual([{ at: clock.now() - DAY, n: 10, y: 7 }]);
    expect(p.stats.totalXp).toBe(expected);
    expect(p.xpLog.every((g) => g.reason === 'import')).toBe(true);
  });

  it('is idempotent: importing the same data again adds nothing', async () => {
    const u = await user();
    await u.send(payload());
    const again = (await u.send(payload())).json<ImportResult>();
    expect(again.xpGained).toBe(0);
    expect(again.imported).toEqual({ questions: 0, cards: 0, articles: 0, attempts: 0 });
  });

  it('keeps what the account already has', async () => {
    const u = await user();
    // The account answered q1 wrong itself.
    const wrong = (q1!.correctIndex + 1) % q1!.options.length;
    await app.inject({
      method: 'POST',
      url: '/quiz/check',
      payload: { questionId: q1!.id, choice: wrong },
      headers: u.auth,
    });
    const body = (await u.send(payload())).json<ImportResult>();
    expect(body.skipped.questions).toBe(2); // unknown id + already answered
    expect((await u.progress()).questions[q1!.id]).toMatchObject({ lastResult: 0 });
  });

  it('clamps timestamps from the future and far-future due dates', async () => {
    const u = await user();
    await u.send(
      payload({
        questions: { [q3!.id]: { lastResult: 1, answeredAt: clock.now() + 365 * DAY } },
        cards: {
          [c2!.id]: { rating: 3, reviews: 1, dueAt: clock.now() + 400 * DAY, history: [3] },
        },
        articlesRead: {},
        attempts: { sql: [{ at: clock.now() + DAY, n: 5, y: 5 }] },
      }),
    );
    const p = await u.progress();
    expect(p.questions[q3!.id]!.firstCorrectAt).toBe(clock.now());
    expect(p.cards[c2!.id]!.dueAt).toBe(clock.now() + 14 * DAY);
    expect(p.attempts.sql).toBeUndefined();
  });

  it('reports a level-up', async () => {
    const u = await user();
    const many = Object.fromEntries(
      content.questions.slice(0, 40).map((q) => [q.id, { lastResult: 1 as const }]),
    );
    const body = (await u.send(payload({ questions: many }))).json<ImportResult>();
    expect(body.levelUp?.from).toBe(1);
    expect(body.levelUp!.to).toBeGreaterThan(1);
  });

  it('validates the payload', async () => {
    const u = await user();
    expect((await u.send({ source: 'guest' })).statusCode).toBe(400);
    expect(
      (await u.send(payload({ cards: { x: { rating: 9, reviews: 1, dueAt: 0, history: [] } } })))
        .statusCode,
    ).toBe(400);
  });
});
