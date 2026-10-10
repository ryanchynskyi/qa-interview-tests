/**
 * HTTP contract between apps/api and apps/web: response shapes and request schemas.
 */
import type { Level } from './content';
import type { DailyState, PlayerStats, ActivityResult } from './engine/progress';
import type { CardProgress, QuestionProgress } from './engine/items';
import type { TaskContent } from './engine/daily-tasks';
import type { XpGrant } from './engine/xp';

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

/** Question ids per section in legacy order, for converting v1 legacy saves. */
export function legacyIndexFromCatalog(c: Catalog): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const q of c.questions) (index[q.sectionId] ??= []).push(q.id);
  return index;
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

/* ---------- auth ---------- */

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
}

export interface AuthResponse {
  /** Short-lived bearer token; the refresh token travels in an httpOnly cookie. */
  accessToken: string;
  user: AuthUser;
}

/* ---------- progress (signed-in users) ---------- */

export interface QuizAttemptRecord {
  at: number;
  n: number;
  y: number;
}

/** Everything the UI shows about a learner; the guest store keeps the same shape. */
export interface PlayerProgress {
  timeZone: string;
  questions: Record<string, QuestionProgress>;
  cards: Record<string, CardProgress>;
  /** articleId → first read time */
  articlesRead: Record<string, number>;
  /** sectionId → newest first */
  attempts: Record<string, QuizAttemptRecord[]>;
  stats: PlayerStats;
  daily: DailyState | null;
  /** Newest last. */
  xpLog: (XpGrant & { at: number })[];
}

/** What a progress mutation changed, so the client can patch its copy. */
export interface ProgressUpdate {
  result: ActivityResult;
  at: number;
  question?: { id: string; state: QuestionProgress };
  card?: { id: string; state: CardProgress };
  articleRead?: { id: string; at: number };
  attempt?: { sectionId: string; attempt: QuizAttemptRecord };
}

export interface CheckAnswerWithProgress extends CheckAnswerResponse {
  /** Present when the request was authenticated. */
  progress?: ProgressUpdate;
}

/* ---------- account (profile page) ---------- */

export interface AccountInfo extends AuthUser {
  createdAt: number;
  /** False for Google-only accounts until they set one. */
  hasPassword: boolean;
  /** Linked sign-in providers, e.g. ['google']. */
  providers: string[];
  /** When the time zone may change again (once a day); null if now. */
  timeZoneLockedUntil: number | null;
}

/** XP earned per local day, oldest first. */
export interface XpDay {
  date: string;
  xp: number;
}
