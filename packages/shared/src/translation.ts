import type { Catalog, ChapterDto, QuizQuestion, RecallCardDto } from './api';
import type { ContentBundle } from './content.schema';

/** Content languages. Ukrainian is the source; others are overlays on it. */
export const CONTENT_LANGS = ['uk', 'en'] as const;
export type ContentLang = (typeof CONTENT_LANGS)[number];

/**
 * A translation overlay, keyed by the source ids (hashes of the Ukrainian text, so they
 * never change with a translation). Every field is optional: a missing one falls back to
 * Ukrainian. Question options keep the source order, index for index, because the
 * correct answer is checked by index.
 */
export interface ContentTranslation {
  topics: Record<string, { name?: string }>;
  sections: Record<string, { name?: string; description?: string }>;
  chapters: Record<string, { title?: string; subtitle?: string }>;
  /** Question and card group labels: Ukrainian label → translation. */
  groups: Record<string, string>;
  questions: Record<
    string,
    { text?: string; code?: string; options?: string[]; explanation?: string }
  >;
  recallCards: Record<string, { question?: string; answer?: string }>;
  articles: Record<string, { title?: string; html?: string }>;
}

export const emptyTranslation = (): ContentTranslation => ({
  topics: {},
  sections: {},
  chapters: {},
  groups: {},
  questions: {},
  recallCards: {},
  articles: {},
});

const group = (tr: ContentTranslation, g: string) => tr.groups[g] ?? g;

export function translateCatalog(c: Catalog, tr: ContentTranslation): Catalog {
  return {
    topics: c.topics.map((t) => ({ ...t, name: tr.topics[t.id]?.name ?? t.name })),
    sections: c.sections.map((s) => ({
      ...s,
      name: tr.sections[s.id]?.name ?? s.name,
      description: tr.sections[s.id]?.description ?? s.description,
    })),
    chapters: c.chapters.map((ch) => ({
      ...ch,
      title: tr.chapters[ch.id]?.title ?? ch.title,
      subtitle: tr.chapters[ch.id]?.subtitle ?? ch.subtitle,
    })),
    questions: c.questions.map((q) => ({ ...q, group: group(tr, q.group) })),
    recallCards: c.recallCards,
  };
}

export function translateQuestion<Q extends QuizQuestion>(q: Q, tr: ContentTranslation): Q {
  const t = tr.questions[q.id];
  const options =
    t?.options && t.options.length === q.options.length
      ? q.options.map((o, i) => t.options![i] || o)
      : q.options;
  return {
    ...q,
    group: group(tr, q.group),
    text: t?.text ?? q.text,
    code: t?.code ?? q.code,
    options,
  };
}

export function translateExplanation(id: string, uk: string, tr: ContentTranslation): string {
  return tr.questions[id]?.explanation ?? uk;
}

export function translateCard(c: RecallCardDto, tr: ContentTranslation): RecallCardDto {
  const t = tr.recallCards[c.id];
  return {
    ...c,
    group: group(tr, c.group),
    question: t?.question ?? c.question,
    answer: t?.answer ?? c.answer,
  };
}

export function translateChapter(ch: ChapterDto, tr: ContentTranslation): ChapterDto {
  return {
    ...ch,
    title: tr.chapters[ch.id]?.title ?? ch.title,
    subtitle: tr.chapters[ch.id]?.subtitle ?? ch.subtitle,
    articles: ch.articles.map((a) => ({
      ...a,
      title: tr.articles[a.id]?.title ?? a.title,
      html: tr.articles[a.id]?.html ?? a.html,
    })),
  };
}

/** Inline `code` spans and fenced/pre blocks must survive translation unchanged in count. */
const codeSpans = (s: string) => (s.match(/`[^`]+`/g) ?? []).length;
const preBlocks = (s: string) => (s.match(/<pre[\s>]/g) ?? []).length;

/**
 * Problems that would break the app or mislead a reader: unknown ids, option lists of
 * another length, lost code spans or blocks. Missing translations are not problems
 * (they fall back to Ukrainian); `coverage` reports them.
 */
export function translationIssues(src: ContentBundle, tr: ContentTranslation): string[] {
  const out: string[] = [];
  const ids = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const unknown = (kind: string, map: Record<string, unknown>, known: Map<string, unknown>) => {
    for (const id of Object.keys(map)) if (!known.has(id)) out.push(`${kind} ${id}: unknown id`);
  };
  unknown('topic', tr.topics, ids(src.topics));
  unknown('section', tr.sections, ids(src.sections));
  unknown('chapter', tr.chapters, ids(src.chapters));
  const questions = ids(src.questions);
  unknown('question', tr.questions, questions);
  unknown('card', tr.recallCards, ids(src.recallCards));
  const articles = ids(src.articles);
  unknown('article', tr.articles, articles);

  const groups = new Set([...src.questions, ...src.recallCards].map((r) => r.group));
  for (const g of Object.keys(tr.groups)) if (!groups.has(g)) out.push(`group "${g}": unknown`);

  for (const [id, t] of Object.entries(tr.questions)) {
    const q = questions.get(id);
    if (!q) continue;
    if (t.options && t.options.length !== q.options.length) {
      out.push(`question ${id}: ${t.options.length} options, source has ${q.options.length}`);
    }
    if (t.code !== undefined && !t.code.trim() !== !q.code.trim()) {
      out.push(`question ${id}: code block added or lost`);
    }
    for (const [field, a, b] of [
      ['text', t.text, q.text],
      ['explanation', t.explanation, q.explanation],
    ] as const) {
      if (a !== undefined && codeSpans(a) !== codeSpans(b)) {
        out.push(`question ${id}: ${field} has ${codeSpans(a)} code spans, source ${codeSpans(b)}`);
      }
    }
  }
  const cards = ids(src.recallCards);
  for (const [id, t] of Object.entries(tr.recallCards)) {
    const c = cards.get(id);
    if (c && t.answer !== undefined && codeSpans(t.answer) !== codeSpans(c.answer)) {
      out.push(
        `card ${id}: answer has ${codeSpans(t.answer)} code spans, source ${codeSpans(c.answer)}`,
      );
    }
  }
  for (const [id, t] of Object.entries(tr.articles)) {
    const a = articles.get(id);
    if (a && t.html !== undefined && preBlocks(t.html) !== preBlocks(a.html)) {
      out.push(`article ${id}: ${preBlocks(t.html)} <pre> blocks, source ${preBlocks(a.html)}`);
    }
  }
  return out;
}

/** How much of the source has a translation, per kind. */
export function translationCoverage(src: ContentBundle, tr: ContentTranslation) {
  const pct = (done: number, total: number) => ({ done, total });
  const groups = new Set([...src.questions, ...src.recallCards].map((r) => r.group));
  return {
    topics: pct(src.topics.filter((t) => tr.topics[t.id]?.name).length, src.topics.length),
    sections: pct(src.sections.filter((s) => tr.sections[s.id]?.name).length, src.sections.length),
    chapters: pct(src.chapters.filter((c) => tr.chapters[c.id]?.title).length, src.chapters.length),
    groups: pct([...groups].filter((g) => tr.groups[g]).length, groups.size),
    questions: pct(
      src.questions.filter((q) => {
        const t = tr.questions[q.id];
        return t?.text && t.options && t.explanation;
      }).length,
      src.questions.length,
    ),
    recallCards: pct(
      src.recallCards.filter((c) => tr.recallCards[c.id]?.question && tr.recallCards[c.id]?.answer)
        .length,
      src.recallCards.length,
    ),
    articles: pct(
      src.articles.filter((a) => tr.articles[a.id]?.title && tr.articles[a.id]?.html).length,
      src.articles.length,
    ),
  };
}
