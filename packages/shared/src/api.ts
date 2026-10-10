/**
 * HTTP contract between apps/api and apps/web: response shapes and request schemas.
 */
import { z } from 'zod';
import type { Level } from './content';
import type { TaskContent } from './engine/daily-tasks';

/* ---------- GET /content/catalog ---------- */

export interface CatalogSection {
  id: string;
  topicId: string;
  name: string;
  description: string;
  order: number;
  questionCount: number;
  /** "Find the bug" section: its questions include the "code is correct" option. */
  codeReview: boolean;
}

export interface CatalogChapter {
  id: string;
  topicId: string;
  title: string;
  subtitle: string;
  order: number;
  articleCount: number;
}

/** Lightweight index of every question: enough for skill stats and filters, no text. */
export interface CatalogQuestion {
  id: string;
  sectionId: string;
  chapterId: string;
  group: string;
  level: Level;
}

export interface CatalogCard {
  id: string;
  topicId: string;
  chapterId: string;
}

export interface Catalog {
  topics: { id: string; name: string; order: number }[];
  sections: CatalogSection[];
  chapters: CatalogChapter[];
  questions: CatalogQuestion[];
  recallCards: CatalogCard[];
}

export function taskContentFromCatalog(c: Catalog): TaskContent {
  return {
    topicIds: c.topics.map((t) => t.id),
    articleChapterIds: c.chapters.filter((ch) => ch.articleCount > 0).map((ch) => ch.id),
    codeReviewSectionIds: c.sections.filter((s) => s.codeReview).map((s) => s.id),
  };
}

/* ---------- GET /sections/:id/questions ---------- */

/** A question as sent before answering: no correct index, no explanation. */
export interface QuizQuestion {
  id: string;
  sectionId: string;
  chapterId: string;
  group: string;
  level: Level;
  text: string;
  code: string;
  options: string[];
}

/* ---------- POST /quiz/check ---------- */

export const checkAnswerSchema = z.object({
  questionId: z.string().min(1).max(64),
  /** Index into `options`; null means skipped. */
  choice: z.number().int().min(0).max(9).nullable(),
});
export type CheckAnswerRequest = z.infer<typeof checkAnswerSchema>;

export interface CheckAnswerResponse {
  outcome: 'correct' | 'wrong' | 'skipped';
  correctIndex: number;
  explanation: string;
}

/* ---------- GET /recall/cards ---------- */

export interface RecallCardDto {
  id: string;
  topicId: string;
  chapterId: string;
  group: string;
  question: string;
  answer: string;
}

/* ---------- GET /kb/chapters/:id ---------- */

export interface ArticleDto {
  id: string;
  title: string;
  kind: string;
  level: Level | null;
  html: string;
}
export interface ChapterDto extends CatalogChapter {
  articles: ArticleDto[];
}

/* ---------- GET /kb/search?q= ---------- */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(40),
});

export interface SearchHit {
  articleId: string;
  /** Position inside the chapter, for `#/kb/topic/chapter/index` links. */
  index: number;
  chapterId: string;
  topicId: string;
  title: string;
  chapterTitle: string;
  snippet: string;
}

/* ---------- errors ---------- */

export interface ApiError {
  error: string;
  message?: string;
}
