import type { FastifyPluginAsync } from 'fastify';
import {
  langQuerySchema,
  searchQuerySchema,
  translateChapter,
  type ChapterDto,
  type ContentLang,
  type SearchHit,
} from '@qa-hub/shared';
import { htmlToText, snippet } from '../lib/text';

/** An article as search sees it, in one language. */
interface SearchRow {
  id: string;
  title: string;
  text: string;
  /** Lowercased title + text. */
  search: string;
  order: number;
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  topicId: string;
  topicOrder: number;
}

const articleSelect = {
  id: true,
  title: true,
  text: true,
  order: true,
  chapterId: true,
  chapter: {
    select: {
      id: true,
      title: true,
      topicId: true,
      order: true,
      topic: { select: { order: true } },
    },
  },
} as const;

/**
 * Every word must appear in the title or text; ranked like the legacy page:
 * +10 per word in the title, +5 when the whole query is in the chapter title.
 */
function rank(rows: SearchRow[], query: string, words: string[], limit: number): SearchHit[] {
  return rows
    .map((r) => {
      const title = r.title.toLowerCase();
      const score =
        words.filter((w) => title.includes(w)).length * 10 +
        (r.chapterTitle.toLowerCase().includes(query) ? 5 : 0);
      return { r, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.r.topicOrder - b.r.topicOrder ||
        a.r.chapterOrder - b.r.chapterOrder ||
        a.r.order - b.r.order,
    )
    .slice(0, limit)
    .map(({ r }) => ({
      articleId: r.id,
      index: r.order,
      chapterId: r.chapterId,
      topicId: r.topicId,
      title: r.title,
      chapterTitle: r.chapterTitle,
      snippet: snippet(r.text, words[0]!),
    }));
}

export const kbRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>('/kb/chapters/:id', async (req, reply) => {
    const { lang } = langQuerySchema.parse(req.query);
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
    const tr = app.translation(lang);
    reply.header('cache-control', 'public, max-age=300');
    return tr ? translateChapter(dto, tr) : dto;
  });

  /**
   * Translated search runs in memory over the translated text (a few hundred articles);
   * built once per language, like the catalog. Untranslated articles keep Ukrainian text.
   */
  const indexes = new Map<ContentLang, Promise<SearchRow[]>>();
  const translatedIndex = (lang: ContentLang): Promise<SearchRow[]> => {
    let index = indexes.get(lang);
    if (!index) {
      const tr = app.translation(lang)!;
      index = app.db.article.findMany({ select: articleSelect }).then((rows) =>
        rows.map((r) => {
          const t = tr.articles[r.id];
          const title = t?.title ?? r.title;
          const text = t?.html ? htmlToText(t.html) : r.text;
          return {
            id: r.id,
            title,
            text,
            search: `${title} ${text}`.toLowerCase(),
            order: r.order,
            chapterId: r.chapterId,
            chapterTitle: tr.chapters[r.chapter.id]?.title ?? r.chapter.title,
            chapterOrder: r.chapter.order,
            topicId: r.chapter.topicId,
            topicOrder: r.chapter.topic.order,
          };
        }),
      );
      index.catch(() => indexes.delete(lang));
      indexes.set(lang, index);
    }
    return index;
  };

  app.get('/kb/search', async (req) => {
    const { q, limit } = searchQuerySchema.parse(req.query);
    const { lang } = langQuerySchema.parse(req.query);
    const query = q.toLowerCase();
    const words = query.split(/\s+/);

    if (app.translation(lang)) {
      const rows = (await translatedIndex(lang)).filter((r) =>
        words.every((w) => r.search.includes(w)),
      );
      return rank(rows, query, words, limit);
    }

    const rows = await app.db.article.findMany({
      where: { AND: words.map((w) => ({ search: { contains: w } })) },
      select: articleSelect,
    });
    return rank(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        text: r.text,
        search: '',
        order: r.order,
        chapterId: r.chapterId,
        chapterTitle: r.chapter.title,
        chapterOrder: r.chapter.order,
        topicId: r.chapter.topicId,
        topicOrder: r.chapter.topic.order,
      })),
      query,
      words,
      limit,
    );
  });
};
