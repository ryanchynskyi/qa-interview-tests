/**
 * Guest mode: all progress lives in localStorage and runs through the shared engine,
 * the same code the API will use for signed-in users. Dependencies (storage, clock,
 * answer checking, catalog) are injected so this can be tested without a browser.
 */
import {
  applyAnswer,
  applyArticleRead,
  applyRecall,
  ensureDaily,
  generateDailyTasks,
  localDate,
  newPlayerStats,
  quizBonus,
  recordActivity,
  taskContentFromCatalog,
  weakChapters,
  type ActivityEvent,
  type ActivityResult,
  type CardProgress,
  type Catalog,
  type CatalogCard,
  type CheckAnswerRequest,
  type CheckAnswerResponse,
  type DailyState,
  type PlayerStats,
  type QuestionProgress,
  type QuizQuestion,
  type SkillProgress,
  type XpGrant,
} from '@qa-hub/shared';

export const STORAGE_KEY = 'qa-hub-guest-v1';
const XP_LOG_SIZE = 100;
const ATTEMPTS_KEPT = 20;

export interface QuizAttempt {
  at: number;
  n: number;
  y: number;
}

export interface ProgressState {
  v: 1;
  /** Seeds daily task generation; becomes irrelevant after sign-up import. */
  guestId: string;
  timeZone: string;
  questions: Record<string, QuestionProgress>;
  cards: Record<string, CardProgress>;
  /** articleId → first read time */
  articlesRead: Record<string, number>;
  attempts: Record<string, QuizAttempt[]>;
  stats: PlayerStats;
  daily: DailyState | null;
  /** Newest last. */
  xpLog: (XpGrant & { at: number })[];
  lastSection: string | null;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GuestStoreDeps {
  storage: KeyValueStorage;
  checkAnswer: (req: CheckAnswerRequest) => Promise<CheckAnswerResponse>;
  now?: () => number;
  timeZone?: () => string;
  newId?: () => string;
}

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const randomId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function emptyState(guestId: string, timeZone: string): ProgressState {
  return {
    v: 1,
    guestId,
    timeZone,
    questions: {},
    cards: {},
    articlesRead: {},
    attempts: {},
    stats: newPlayerStats(),
    daily: null,
    xpLog: [],
    lastSection: null,
  };
}

/** Engine input for skill stats, derived from stored progress. */
export function skillProgressOf(state: ProgressState): SkillProgress {
  const questions: Record<string, 0 | 1> = {};
  for (const [id, q] of Object.entries(state.questions)) questions[id] = q.lastResult;
  return { questions, cards: state.cards };
}

export class GuestStore {
  private state: ProgressState;
  private listeners = new Set<() => void>();
  private catalog: Catalog | null = null;
  private readonly now: () => number;
  private readonly tz: () => string;

  constructor(private readonly deps: GuestStoreDeps) {
    this.now = deps.now ?? Date.now;
    this.tz = deps.timeZone ?? browserTimeZone;
    this.state = this.load();
  }

  /* ---------- store plumbing (useSyncExternalStore-compatible) ---------- */

  getSnapshot = (): ProgressState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /** Another tab wrote progress: pick it up. */
  reload(): void {
    this.state = this.load();
    this.emit();
  }

  private load(): ProgressState {
    try {
      const raw = this.deps.storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProgressState;
        if (parsed && parsed.v === 1 && parsed.guestId) return parsed;
      }
    } catch {
      // Corrupt or unavailable storage: start fresh rather than crash.
    }
    return emptyState((this.deps.newId ?? randomId)(), this.tz());
  }

  private commit(next: ProgressState): void {
    this.state = next;
    try {
      this.deps.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode / quota: progress still works for this session.
    }
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /* ---------- daily tasks ---------- */

  /** Called once the catalog is loaded; generation needs to know the content. */
  setCatalog(catalog: Catalog): void {
    this.catalog = catalog;
    this.refreshDaily();
  }

  /** Makes sure today's tasks exist (new local day → new set). */
  refreshDaily(): void {
    const s = this.withCurrentTimeZone(this.state);
    const daily = this.dailyFor(s);
    if (daily !== s.daily || s !== this.state) this.commit({ ...s, daily });
  }

  private withCurrentTimeZone(s: ProgressState): ProgressState {
    const tz = this.tz();
    return tz === s.timeZone ? s : { ...s, timeZone: tz };
  }

  private dailyFor(s: ProgressState): DailyState | null {
    const catalog = this.catalog;
    if (!catalog) return s.daily;
    const now = this.now();
    return ensureDaily(s.daily, localDate(now, s.timeZone), (date) =>
      generateDailyTasks(s.guestId, date, taskContentFromCatalog(catalog), {
        weakChapterIds: weakChapters(catalog, skillProgressOf(s), now).map((c) => c.chapterId),
        dueCards: Object.values(s.cards).filter((c) => c.dueAt <= now).length,
      }),
    );
  }

  /** Shared tail of every action: tasks, streak, bonuses, XP log, persist. */
  private record(s: ProgressState, event: ActivityEvent, itemGrants: XpGrant[]): ActivityResult {
    const daily = this.dailyFor(s);
    const result = recordActivity({
      stats: s.stats,
      daily,
      event,
      itemGrants,
      timeZone: s.timeZone,
    });
    const logged = result.grants.map((g) => ({ ...g, at: event.at }));
    this.commit({
      ...s,
      stats: result.stats,
      daily: result.daily,
      xpLog: [...s.xpLog, ...logged].slice(-XP_LOG_SIZE),
    });
    return result;
  }

  /* ---------- actions ---------- */

  async answer(
    q: QuizQuestion,
    topicId: string,
    choice: number | null,
  ): Promise<{ check: CheckAnswerResponse; result: ActivityResult }> {
    // The server decides correctness; only then is progress touched.
    const check = await this.deps.checkAnswer({ questionId: q.id, choice });
    const s = this.withCurrentTimeZone(this.state);
    const at = this.now();
    const item = applyAnswer(
      s.questions[q.id],
      { questionId: q.id, level: q.level, outcome: check.outcome },
      { now: at, timeZone: s.timeZone },
    );
    const result = this.record(
      { ...s, questions: { ...s.questions, [q.id]: item.next } },
      {
        type: 'answer',
        at,
        questionId: q.id,
        sectionId: q.sectionId,
        topicId,
        chapterId: q.chapterId,
        outcome: check.outcome,
      },
      item.grants,
    );
    return { check, result };
  }

  /** End of a quiz run: attempt history, quiz bonus, ACCURACY task. */
  finishQuiz(sectionId: string, answered: number, correct: number): ActivityResult {
    const s = this.withCurrentTimeZone(this.state);
    const at = this.now();
    const attempts = [{ at, n: answered, y: correct }, ...(s.attempts[sectionId] ?? [])].slice(
      0,
      ATTEMPTS_KEPT,
    );
    return this.record(
      { ...s, attempts: { ...s.attempts, [sectionId]: attempts } },
      { type: 'quiz_finish', at, sectionId, answered, correct },
      quizBonus(answered, correct),
    );
  }

  rate(card: CatalogCard, rating: number): ActivityResult & { wasDue: boolean } {
    const s = this.withCurrentTimeZone(this.state);
    const at = this.now();
    const item = applyRecall(s.cards[card.id], rating, card.id, { now: at, timeZone: s.timeZone });
    const result = this.record(
      { ...s, cards: { ...s.cards, [card.id]: item.next } },
      {
        type: 'recall',
        at,
        cardId: card.id,
        topicId: card.topicId,
        chapterId: card.chapterId,
        rating,
        wasDue: item.wasDue,
      },
      item.grants,
    );
    return { ...result, wasDue: item.wasDue };
  }

  readArticle(articleId: string, chapterId: string, topicId: string): ActivityResult {
    const s = this.withCurrentTimeZone(this.state);
    const at = this.now();
    const already = articleId in s.articlesRead;
    return this.record(
      already ? s : { ...s, articlesRead: { ...s.articlesRead, [articleId]: at } },
      { type: 'article_read', at, articleId, topicId, chapterId },
      applyArticleRead(already, articleId),
    );
  }

  /** "Clear this section's progress" from the legacy page. XP already earned stays. */
  resetSection(sectionId: string, questionIds: readonly string[]): void {
    const questions = { ...this.state.questions };
    for (const id of questionIds) delete questions[id];
    const attempts = { ...this.state.attempts };
    delete attempts[sectionId];
    this.commit({ ...this.state, questions, attempts });
  }

  setLastSection(sectionId: string): void {
    if (this.state.lastSection !== sectionId)
      this.commit({ ...this.state, lastSection: sectionId });
  }
}
