/**
 * Guest mode: all progress lives in localStorage and runs through the shared engine,
 * the same code the API will use for signed-in users. Dependencies (storage, clock,
 * answer checking, catalog) are injected so this can be tested without a browser.
 */
import {
  applyAnswer,
  applyArticleRead,
  applyRecall,
  clampDueAt,
  emptyCounts,
  ensureDaily,
  generateDailyTasks,
  importGrants,
  levelFromXp,
  localDate,
  newPlayerStats,
  quizBonus,
  recordActivity,
  taskContentFromCatalog,
  weakChapters,
  type ActivityEvent,
  type ActivityResult,
  type Catalog,
  type CatalogCard,
  type CheckAnswerRequest,
  type CheckAnswerResponse,
  type DailyState,
  type ImportPayload,
  type Level,
  type ImportResult,
  type QuizQuestion,
  type SkillProgress,
  type XpGrant,
} from '@qa-hub/shared';
import type { ProgressRepo, ProgressState } from './types';

export const STORAGE_KEY = 'qa-hub-guest-v1';
/** Where guest progress is kept after it has been moved into an account (just in case). */
export const IMPORTED_BACKUP_KEY = 'qa-hub-guest-v1.imported';
const XP_LOG_SIZE = 100;
const ATTEMPTS_KEPT = 20;

export type { ProgressState };

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

export class GuestStore implements ProgressRepo {
  readonly kind = 'guest' as const;
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
  async finishQuiz(sectionId: string, questionIds: string[]): Promise<ActivityResult> {
    const s = this.withCurrentTimeZone(this.state);
    const ids = [...new Set(questionIds)];
    const answered = ids.length;
    const correct = ids.filter((id) => s.questions[id]?.lastResult === 1).length;
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

  async rate(card: CatalogCard, rating: number): Promise<ActivityResult & { wasDue: boolean }> {
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

  async readArticle(
    articleId: string,
    chapterId: string,
    topicId: string,
  ): Promise<ActivityResult> {
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
  async resetSection(sectionId: string, questionIds: readonly string[]): Promise<void> {
    const questions = { ...this.state.questions };
    for (const id of questionIds) delete questions[id];
    const attempts = { ...this.state.attempts };
    delete attempts[sectionId];
    this.commit({ ...this.state, questions, attempts });
  }

  /** Same merge rules as the server: known content only, existing items win, XP recomputed. */
  async importProgress(p: ImportPayload): Promise<ImportResult> {
    const catalog = this.catalog;
    if (!catalog) throw new Error('Зміст ще завантажується, спробуй за мить');
    const s = this.state;
    const now = this.now();
    const floor = Date.UTC(2020, 0, 1);
    const at = (t: number | undefined) =>
      t === undefined ? now : Math.min(Math.max(t, floor), now);
    const level = new Map(catalog.questions.map((q) => [q.id, q.level]));
    const cardIds = new Set(catalog.recallCards.map((c) => c.id));
    const articleCount = new Map(catalog.chapters.map((ch) => [ch.id, ch.articleCount]));
    const isArticle = (id: string) => {
      const m = /^(.+):(\d+)$/.exec(id);
      return !!m && Number(m[2]) < (articleCount.get(m[1]!) ?? 0);
    };
    const sections = new Set(catalog.sections.map((x) => x.id));

    const questions = { ...s.questions };
    const correctLevels: Level[] = [];
    let newQ = 0;
    for (const [id, q] of Object.entries(p.questions)) {
      const lvl = level.get(id);
      if (!lvl || id in questions) continue;
      const when = at(q.answeredAt);
      questions[id] = {
        lastResult: q.lastResult,
        attempts: q.attempts ?? 1,
        firstCorrectAt: q.lastResult === 1 ? when : null,
        lastXpDate: null,
      };
      if (q.lastResult === 1) correctLevels.push(lvl);
      newQ++;
    }
    const cards = { ...s.cards };
    const cardRatings: number[] = [];
    for (const [id, c] of Object.entries(p.cards)) {
      if (!cardIds.has(id) || id in cards) continue;
      cards[id] = {
        ...c,
        dueAt: clampDueAt(c.dueAt, now),
        history: c.history.length ? c.history : [c.rating],
      };
      cardRatings.push(c.rating);
    }
    const articlesRead = { ...s.articlesRead };
    let newA = 0;
    for (const [id, t] of Object.entries(p.articlesRead)) {
      if (!isArticle(id) || id in articlesRead) continue;
      articlesRead[id] = at(t);
      newA++;
    }
    const attempts = { ...s.attempts };
    let newAttempts = 0;
    let attemptsIn = 0;
    for (const [sec, list] of Object.entries(p.attempts)) {
      attemptsIn += list.length;
      if (!sections.has(sec)) continue;
      const have = new Set((attempts[sec] ?? []).map((a) => a.at));
      const add = list.filter((a) => a.at <= now && a.y <= a.n && !have.has(a.at));
      if (!add.length) continue;
      newAttempts += add.length;
      attempts[sec] = [...(attempts[sec] ?? []), ...add]
        .sort((x, y) => y.at - x.at)
        .slice(0, ATTEMPTS_KEPT);
    }

    const grants = importGrants({ correctLevels, cardRatings, articles: newA });
    const xpGained = grants.reduce((n, g) => n + g.amount, 0);
    const before = levelFromXp(s.stats.totalXp).level;
    const totalXp = s.stats.totalXp + xpGained;
    const after = levelFromXp(totalXp).level;
    this.commit({
      ...s,
      questions,
      cards,
      articlesRead,
      attempts,
      stats: { ...s.stats, totalXp },
      xpLog: [
        ...s.xpLog,
        ...grants.map((g) => ({ ...g, refId: `${p.source}:${g.refId}`, at: now })),
      ].slice(-XP_LOG_SIZE),
    });
    const total = (o: object) => Object.keys(o).length;
    return {
      imported: {
        questions: newQ,
        cards: cardRatings.length,
        articles: newA,
        attempts: newAttempts,
      },
      skipped: {
        ...emptyCounts(),
        questions: total(p.questions) - newQ,
        cards: total(p.cards) - cardRatings.length,
        articles: total(p.articlesRead) - newA,
        attempts: attemptsIn - newAttempts,
      },
      xpGained,
      levelUp: after > before ? { from: before, to: after } : null,
    };
  }

  /** After guest progress moved into an account: keep a backup copy, start the guest fresh. */
  clearAfterImport(): void {
    try {
      this.deps.storage.setItem(IMPORTED_BACKUP_KEY, JSON.stringify(this.state));
    } catch {
      // storage unavailable; the account has the data anyway
    }
    this.commit(emptyState(this.state.guestId, this.state.timeZone));
  }

  setLastSection(sectionId: string): void {
    if (this.state.lastSection !== sectionId)
      this.commit({ ...this.state, lastSection: sectionId });
  }
}
