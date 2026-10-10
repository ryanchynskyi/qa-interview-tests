import type { PrismaClient } from '@prisma/client';
import { OK_TEXT, type Catalog } from '@qa-hub/shared';

/** Content only changes on re-seed + restart, so the catalog is built once per process. */
export async function loadCatalog(db: PrismaClient): Promise<Catalog> {
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

/** Memoised loader: built on first use, rebuilt only if building failed. */
export function catalogCache(db: PrismaClient): () => Promise<Catalog> {
  let catalog: Promise<Catalog> | null = null;
  return () =>
    (catalog ??= loadCatalog(db).catch((err) => {
      catalog = null;
      throw err;
    }));
}
