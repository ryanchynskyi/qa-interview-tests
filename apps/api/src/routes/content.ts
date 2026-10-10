import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { OK_TEXT, type Catalog, type QuizQuestion, type RecallCardDto } from '@qa-hub/shared';

/** Content only changes on re-seed + restart, so the catalog is built once per process. */
async function loadCatalog(db: PrismaClient): Promise<Catalog> {
  const [topics, sections, chapters, questions, cards, codeReview] = await Promise.all([
    db.topic.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true, order: true } }),
    db.section.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { questions: true } } },
    }),
    db.chapter.findMany({ include: { _count: { select: { articles: true } } } }),
    db.question.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, sectionId: true, chapterId: true, group: true, level: true },
    }),
    db.recallCard.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, topicId: true, chapterId: true },
    }),
    db.question.findMany({
      where: { options: { has: OK_TEXT } },
      distinct: ['sectionId'],
      select: { sectionId: true },
    }),
  ]);

  const topicOrder = new Map(topics.map((t) => [t.id, t.order]));
  const sectionOrder = new Map(sections.map((s) => [s.id, s.order]));
  const codeReviewIds = new Set(codeReview.map((q) => q.sectionId));
  const byTopicThen = <T extends { topicId: string; order: number }>(a: T, b: T) =>
    (topicOrder.get(a.topicId) ?? 0) - (topicOrder.get(b.topicId) ?? 0) || a.order - b.order;

  return {
    topics,
    sections: sections.map(({ _count, ...s }) => ({
      ...s,
      questionCount: _count.questions,
      codeReview: codeReviewIds.has(s.id),
    })),
    chapters: chapters
      .map(({ _count, ...ch }) => ({ ...ch, articleCount: _count.articles }))
      .sort(byTopicThen),
    // Stable sort keeps the per-section `order` from the query.
    questions: questions.sort(
      (a, b) => (sectionOrder.get(a.sectionId) ?? 0) - (sectionOrder.get(b.sectionId) ?? 0),
    ),
    recallCards: cards.sort(
      (a, b) => (topicOrder.get(a.topicId) ?? 0) - (topicOrder.get(b.topicId) ?? 0),
    ),
  };
}

export const contentRoutes: FastifyPluginAsync = async (app) => {
  let catalog: Promise<Catalog> | null = null;

  app.get('/content/catalog', async (_req, reply) => {
    catalog ??= loadCatalog(app.db).catch((err) => {
      catalog = null; // don't cache a failure
      throw err;
    });
    reply.header('cache-control', 'public, max-age=300');
    return catalog;
  });

  app.get<{ Params: { id: string } }>('/sections/:id/questions', async (req, reply) => {
    const section = await app.db.section.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!section) return reply.code(404).send({ error: 'not_found', message: 'Unknown section' });
    const questions: QuizQuestion[] = await app.db.question.findMany({
      where: { sectionId: section.id },
      orderBy: { order: 'asc' },
      // Deliberately no correctIndex / explanation: those come from POST /quiz/check.
      select: {
        id: true,
        sectionId: true,
        chapterId: true,
        group: true,
        level: true,
        text: true,
        code: true,
        options: true,
      },
    });
    reply.header('cache-control', 'public, max-age=300');
    return questions;
  });

  app.get('/recall/cards', async (_req, reply) => {
    const cards: RecallCardDto[] = await app.db.recallCard.findMany({
      orderBy: [{ topic: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        topicId: true,
        chapterId: true,
        group: true,
        question: true,
        answer: true,
      },
    });
    reply.header('cache-control', 'public, max-age=300');
    return cards;
  });
};
