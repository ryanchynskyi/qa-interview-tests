/**
 * One-off (re-runnable) migration: reads the legacy single-page app and writes
 * normalized content JSON to packages/content/data. Run: `npm run content:extract`.
 *
 * Legacy shapes: quiz[section][] = {t group, l level, q, c code, o options (o[0] correct), e}
 *                kb[topic][] = {id, title, sub, arts: [{t, s kind, l?, h html}]}
 *                recall[topic][] = {t group, k chapterId, q, a}
 *                qmap[section][group] = chapterId
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cardId,
  contentBundleSchema,
  questionId,
  type Article,
  type Chapter,
  type ContentBundle,
  type Level,
  type Question,
  type RecallCard,
  type Section,
  type Topic,
} from '@qa-hub/shared';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const legacyPath = resolve(root, 'legacy/index.html');
const outDir = resolve(root, 'packages/content/data');

interface LegacyQuiz {
  t: string;
  l: Level;
  q: string;
  c?: string;
  o: string[];
  e: string;
}
interface LegacyArticle {
  t: string;
  s: string;
  l?: Level;
  h: string;
}
interface LegacyChapter {
  id: string;
  title: string;
  sub?: string;
  arts: LegacyArticle[];
}
interface LegacyCard {
  t: string;
  k: string;
  q: string;
  a: string;
}
interface LegacyData {
  quiz: Record<string, LegacyQuiz[]>;
  kb: Record<string, LegacyChapter[]>;
  recall: Record<string, LegacyCard[]>;
  qmap: Record<string, Record<string, string>>;
}
interface LegacySection {
  id: string;
  name: string;
  desc: string;
}
interface LegacyTopic {
  id: string;
  name: string;
  secs: string[];
}

const html = readFileSync(legacyPath, 'utf8');

const dataMatch = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
if (!dataMatch?.[1]) throw new Error('Embedded data block not found in legacy/index.html');
const data = JSON.parse(dataMatch[1]) as LegacyData;

/** SECTIONS and TOPICS are plain object literals in the legacy script; evaluate just that slice. */
function literal<T>(name: string): T {
  const m = html.match(new RegExp(`const ${name}=(\\[[\\s\\S]*?\\n\\]);`));
  if (!m?.[1]) throw new Error(`const ${name} not found in legacy/index.html`);
  return new Function(`return ${m[1]}`)() as T;
}
const legacySections = literal<LegacySection[]>('SECTIONS');
const legacyTopics = literal<LegacyTopic[]>('TOPICS');

const topics: Topic[] = legacyTopics.map((t, order) => ({ id: t.id, name: t.name, order }));

const topicOfSection = new Map(legacyTopics.flatMap((t) => t.secs.map((s) => [s, t.id] as const)));
const sections: Section[] = legacySections.map((s, order) => {
  const topicId = topicOfSection.get(s.id);
  if (!topicId) throw new Error(`Section ${s.id} belongs to no topic`);
  return { id: s.id, topicId, name: s.name, description: s.desc, order };
});

const chapters: Chapter[] = [];
const articles: Article[] = [];
for (const t of legacyTopics) {
  (data.kb[t.id] ?? []).forEach((ch, order) => {
    chapters.push({ id: ch.id, topicId: t.id, title: ch.title, subtitle: ch.sub ?? '', order });
    ch.arts.forEach((a, i) => {
      articles.push({
        id: `${ch.id}:${i}`,
        chapterId: ch.id,
        title: a.t,
        kind: a.s,
        level: a.l ?? null,
        html: a.h,
        order: i,
      });
    });
  });
}

const questions: Question[] = [];
for (const s of legacySections) {
  (data.quiz[s.id] ?? []).forEach((x, order) => {
    const chapterId = data.qmap[s.id]?.[x.t];
    if (!chapterId) throw new Error(`No chapter for ${s.id} / ${x.t}`);
    questions.push({
      id: questionId(x.q, x.c ?? ''),
      sectionId: s.id,
      chapterId,
      group: x.t,
      level: x.l,
      text: x.q,
      code: x.c ?? '',
      options: x.o,
      correctIndex: 0, // legacy convention: the first option is always the right one
      explanation: x.e,
      order,
    });
  });
}

const recallCards: RecallCard[] = [];
for (const t of legacyTopics) {
  (data.recall[t.id] ?? []).forEach((c, order) => {
    recallCards.push({
      id: cardId(c.q),
      topicId: t.id,
      chapterId: c.k,
      group: c.t,
      question: c.q,
      answer: c.a,
      order,
    });
  });
}

const bundle: ContentBundle = contentBundleSchema.parse({
  topics,
  sections,
  chapters,
  articles,
  questions,
  recallCards,
});

mkdirSync(outDir, { recursive: true });
const files: Record<string, unknown> = {
  'topics.json': bundle.topics,
  'sections.json': bundle.sections,
  'chapters.json': bundle.chapters,
  'articles.json': bundle.articles,
  'questions.json': bundle.questions,
  'recall-cards.json': bundle.recallCards,
};
for (const [name, rows] of Object.entries(files)) {
  writeFileSync(resolve(outDir, name), JSON.stringify(rows, null, 2) + '\n');
}

console.log(
  `Extracted: ${topics.length} topics, ${sections.length} sections, ${chapters.length} chapters, ` +
    `${articles.length} articles, ${questions.length} questions, ${recallCards.length} recall cards`,
);
