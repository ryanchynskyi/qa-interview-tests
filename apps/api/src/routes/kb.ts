import type { FastifyPluginAsync } from 'fastify';
import { searchQuerySchema, type ChapterDto, type SearchHit } from '@qa-hub/shared';
import { snippet } from '../lib/text';

export const kbRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/kb/chapters/:id', async (req, reply) => {
    const ch = await app.db.chapter.findUnique({
      where: { id: req.params.id },
      include: {
        articles: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, kind: true, level: true, html: true },
        },
      },
    });
    if (!ch) return reply.code(404).send({ error: 'not_found', message: 'Unknown chapter' });
    const dto: ChapterDto = { ...ch, articleCount: ch.articles.length };
    reply.header('cache-control', 'public, max-age=300');
    return dto;
  });

  /**
   * Every word must appear in the title or text; ranked like the legacy page:
   * +10 per word in the title, +5 when the whole query is in the chapter title.
   */
  app.get('/kb/search', async (req) => {
    const { q, limit } = searchQuerySchema.parse(req.query);
    const query = q.toLowerCase();
    const words = query.split(/\s+/);
    const rows = await app.db.article.findMany({
      where: { AND: words.map((w) => ({ search: { contains: w } })) },
      select: {
        id: true,
        title: true,
        text: true,
        order: true,
        chapterId: true,
        chapter: {
          select: { title: true, topicId: true, order: true, topic: { select: { order: true } } },
        },
      },
    });
    const hits = rows
      .map((r) => {
        const title = r.title.toLowerCase();
        const score =
          words.filter((w) => title.includes(w)).length * 10 +
          (r.chapter.title.toLowerCase().includes(query) ? 5 : 0);
        return { r, score };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.r.chapter.topic.order - b.r.chapter.topic.order ||
          a.r.chapter.order - b.r.chapter.order ||
          a.r.order - b.r.order,
      )
      .slice(0, limit);
    return hits.map(({ r }): SearchHit => ({
      articleId: r.id,
      index: r.order,
      chapterId: r.chapterId,
      topicId: r.chapter.topicId,
      title: r.title,
      chapterTitle: r.chapter.title,
      snippet: snippet(r.text, words[0]!),
    }));
  });
};
