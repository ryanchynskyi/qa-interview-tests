/**
 * Content in another language: the overlay replaces text field by field, falls back to
 * Ukrainian elsewhere, and never changes ids or the order of answer options.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  emptyTranslation,
  type Catalog,
  type ChapterDto,
  type CheckAnswerResponse,
  type QuizQuestion,
  type RecallCardDto,
  type SearchHit,
} from '@qa-hub/shared';
import { loadContent } from '@qa-hub/content';
import { buildApp } from '../src/app';

const url = process.env.TEST_DATABASE_URL;
const content = loadContent();

const question = content.questions.find((q) => q.sectionId === 'sql')!;
const card = content.recallCards[0]!;
const article = content.articles.find((a) => a.chapterId === question.chapterId)!;
const topic = content.topics[0]!;

const en = emptyTranslation();
en.topics[topic.id] = { name: 'EN topic' };
en.chapters[question.chapterId] = { title: 'EN chapter', subtitle: 'EN subtitle' };
en.groups[question.group] = 'EN group';
en.questions[question.id] = {
  text: 'EN question text',
  options: question.options.map((_, i) => `EN option ${i}`),
  explanation: 'EN explanation',
};
en.recallCards[card.id] = { question: 'EN card question', answer: 'EN card answer' };
en.articles[article.id] = { title: 'EN article', html: '<p>quokkafication happens here</p>' };

describe.skipIf(!url)('translated content (database)', () => {
  let db: PrismaClient;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    app = await buildApp({
      db,
      webOrigin: 'http://localhost:5173',
      jwtSecret: 'x'.repeat(32),
      translations: { en },
    });
  });
  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  const get = <T>(path: string) =>
    app.inject({ method: 'GET', url: path }).then((r) => r.json<T>());

  it('translates catalog names and falls back to Ukrainian where there is no translation', async () => {
    const uk = await get<Catalog>('/content/catalog');
    const tr = await get<Catalog>('/content/catalog?lang=en');
    expect(tr.topics[0]!.name).toBe('EN topic');
    expect(tr.topics[1]!.name).toBe(uk.topics[1]!.name);
    expect(tr.chapters.find((c) => c.id === question.chapterId)!.title).toBe('EN chapter');
    expect(tr.questions.find((q) => q.id === question.id)!.group).toBe('EN group');
    // Ids, order and counts are the same in every language.
    expect(tr.questions.map((q) => q.id)).toEqual(uk.questions.map((q) => q.id));
    expect(uk.topics[0]!.name).toBe(topic.name);
  });

  it('translates questions without moving the options, so the right answer stays right', async () => {
    const qs = await get<QuizQuestion[]>('/sections/sql/questions?lang=en');
    const q = qs.find((x) => x.id === question.id)!;
    expect(q.text).toBe('EN question text');
    expect(q.options).toEqual(question.options.map((_, i) => `EN option ${i}`));

    const res = await app.inject({
      method: 'POST',
      url: '/quiz/check',
      payload: { questionId: question.id, choice: question.correctIndex, lang: 'en' },
    });
    const body = res.json<CheckAnswerResponse>();
    expect(body.outcome).toBe('correct');
    expect(body.explanation).toBe('EN explanation');

    const ukCheck = await app.inject({
      method: 'POST',
      url: '/quiz/check',
      payload: { questionId: question.id, choice: question.correctIndex },
    });
    expect(ukCheck.json<CheckAnswerResponse>().explanation).toBe(question.explanation);
  });

  it('translates recall cards and KB chapters', async () => {
    const cards = await get<RecallCardDto[]>('/recall/cards?lang=en');
    expect(cards.find((c) => c.id === card.id)).toMatchObject({
      question: 'EN card question',
      answer: 'EN card answer',
    });
    const ch = await get<ChapterDto>(`/kb/chapters/${question.chapterId}?lang=en`);
    expect(ch.title).toBe('EN chapter');
    const a = ch.articles.find((x) => x.id === article.id)!;
    expect(a).toMatchObject({ title: 'EN article', html: '<p>quokkafication happens here</p>' });
  });

  it('searches the translated text in English and the Ukrainian text otherwise', async () => {
    const hits = await get<SearchHit[]>('/kb/search?q=quokkafication&lang=en');
    expect(hits.map((h) => h.articleId)).toEqual([article.id]);
    expect(hits[0]!.title).toBe('EN article');
    expect(hits[0]!.chapterTitle).toBe('EN chapter');
    expect(await get<SearchHit[]>('/kb/search?q=quokkafication')).toEqual([]);
  });

  it('treats an unknown language as Ukrainian', async () => {
    const res = await app.inject({ method: 'GET', url: '/content/catalog?lang=xx' });
    expect(res.statusCode).toBe(200);
    expect(res.json<Catalog>().topics[0]!.name).toBe(topic.name);
  });
});
