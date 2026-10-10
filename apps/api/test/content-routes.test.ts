/**
 * Integration tests against a real, seeded database (read-only).
 * Set TEST_DATABASE_URL (apps/api/.env locally, a Postgres service in CI).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type {
  Catalog,
  ChapterDto,
  CheckAnswerResponse,
  QuizQuestion,
  RecallCardDto,
  SearchHit,
} from '@qa-hub/shared';
import { loadContent } from '@qa-hub/content';
import { buildApp } from '../src/app';

const url = process.env.TEST_DATABASE_URL;
const content = loadContent();

describe.skipIf(!url)('content API (database)', () => {
  let db: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    app = await buildApp({ db, webOrigin: 'http://localhost:5173', jwtSecret: 'x'.repeat(32) });
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  const get = (path: string) => app.inject({ method: 'GET', url: path });
  const check = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/quiz/check', payload });

  describe('GET /content/catalog', () => {
    it('lists everything in legacy order', async () => {
      const res = await get('/content/catalog');
      expect(res.statusCode).toBe(200);
      const c = res.json<Catalog>();
      expect(c.topics.map((t) => t.id)).toEqual(content.topics.map((t) => t.id));
      expect(c.sections.map((s) => s.id)).toEqual(content.sections.map((s) => s.id));
      expect(c.chapters).toHaveLength(91);
      expect(c.questions).toHaveLength(704);
      expect(c.recallCards).toHaveLength(166);
      expect(c.sections.filter((s) => s.codeReview).map((s) => s.id)).toEqual(['pwfix', 'tsfix']);
      expect(c.sections.reduce((n, s) => n + s.questionCount, 0)).toBe(704);
      expect(c.chapters.reduce((n, ch) => n + ch.articleCount, 0)).toBe(442);
    });

    it('never includes answers', async () => {
      const body = (await get('/content/catalog')).body;
      expect(body).not.toContain('correctIndex');
      expect(body).not.toContain('explanation');
    });
  });

  describe('GET /sections/:id/questions', () => {
    it('returns the section questions without answers', async () => {
      const res = await get('/sections/sql/questions');
      expect(res.statusCode).toBe(200);
      const qs = res.json<QuizQuestion[]>();
      expect(qs).toHaveLength(65);
      expect(Object.keys(qs[0]!).sort()).toEqual(
        ['chapterId', 'code', 'group', 'id', 'level', 'options', 'sectionId', 'text'].sort(),
      );
    });

    it('404s for an unknown section', async () => {
      const res = await get('/sections/nope/questions');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: 'not_found' });
    });
  });

  describe('POST /quiz/check', () => {
    const q = content.questions.find((x) => x.sectionId === 'sql')!;
    const wrong = (q.correctIndex + 1) % q.options.length;

    it('marks the right option correct and returns the explanation', async () => {
      const res = await check({ questionId: q.id, choice: q.correctIndex });
      expect(res.statusCode).toBe(200);
      expect(res.json<CheckAnswerResponse>()).toEqual({
        outcome: 'correct',
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      });
    });

    it('marks other options wrong and a null choice skipped', async () => {
      expect((await check({ questionId: q.id, choice: wrong })).json()).toMatchObject({
        outcome: 'wrong',
        correctIndex: q.correctIndex,
      });
      expect((await check({ questionId: q.id, choice: null })).json()).toMatchObject({
        outcome: 'skipped',
      });
    });

    it('validates input', async () => {
      expect((await check({ questionId: q.id })).statusCode).toBe(400);
      expect((await check({ questionId: q.id, choice: 'a' })).statusCode).toBe(400);
      expect((await check({ questionId: q.id, choice: 7 })).statusCode).toBe(400);
      expect((await check({ questionId: 'missing', choice: 0 })).statusCode).toBe(404);
      const bad = await app.inject({
        method: 'POST',
        url: '/quiz/check',
        headers: { 'content-type': 'application/json' },
        payload: '{not json',
      });
      expect(bad.statusCode).toBe(400);
    });
  });

  describe('GET /recall/cards', () => {
    it('returns all cards with model answers', async () => {
      const cards = (await get('/recall/cards')).json<RecallCardDto[]>();
      expect(cards).toHaveLength(166);
      expect(cards[0]).toMatchObject({ topicId: 'playwright' });
      expect(cards.every((c) => c.question && c.answer)).toBe(true);
    });
  });

  describe('knowledge base', () => {
    it('returns a chapter with its articles in order', async () => {
      const res = await get('/kb/chapters/sq-0');
      expect(res.statusCode).toBe(200);
      const ch = res.json<ChapterDto>();
      expect(ch).toMatchObject({ id: 'sq-0', topicId: 'sql', title: 'Основи баз даних' });
      expect(ch.articles.length).toBe(ch.articleCount);
      expect(ch.articles[0]!.html).toContain('<');
      expect((await get('/kb/chapters/nope')).statusCode).toBe(404);
    });

    it('searches case-insensitively in Cyrillic and ranks title hits first', async () => {
      const lower = (await get(`/kb/search?q=${encodeURIComponent('реляційна')}`)).json<
        SearchHit[]
      >();
      const upper = (await get(`/kb/search?q=${encodeURIComponent('РЕЛЯЦІЙНА')}`)).json<
        SearchHit[]
      >();
      expect(lower.length).toBeGreaterThan(0);
      expect(upper).toEqual(lower);
      expect(lower[0]!.title.toLowerCase()).toContain('реляційна');
      expect(lower[0]).toMatchObject({ chapterId: 'sq-0', topicId: 'sql', index: 0 });
    });

    it('requires every word and limits results', async () => {
      const hits = (await get('/kb/search?q=playwright%20fixture&limit=5')).json<SearchHit[]>();
      expect(hits.length).toBeLessThanOrEqual(5);
      expect((await get('/kb/search?q=zzqqxx%20playwright')).json()).toEqual([]);
    });

    it('rejects too-short queries', async () => {
      expect((await get('/kb/search?q=a')).statusCode).toBe(400);
      expect((await get('/kb/search')).statusCode).toBe(400);
    });
  });
});
