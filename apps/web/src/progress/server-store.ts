/**
 * Progress for a signed-in user: the API is the source of truth. The store keeps a
 * local copy for rendering, loaded once and patched from each mutation's response.
 */
import {
  localDate,
  type ActivityResult,
  type AuthUser,
  type CatalogCard,
  type CheckAnswerResponse,
  type PlayerProgress,
  type ProgressUpdate,
  type QuizQuestion,
} from '@qa-hub/shared';
import type { api as apiClient } from '../api';
import type { ProgressRepo, ProgressState } from './types';

const XP_LOG_SIZE = 100;
const ATTEMPTS_SHOWN = 20;
const LAST_SECTION_KEY = 'qa-hub-last-section';

type Api = Pick<
  typeof apiClient,
  'progress' | 'checkAnswer' | 'finishQuiz' | 'rateCard' | 'readArticle' | 'resetSection'
>;

export interface ServerStoreDeps {
  api: Api;
  user: AuthUser;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

export class ServerStore implements ProgressRepo {
  readonly kind = 'server' as const;
  private state: ProgressState | null = null;
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private readonly now: () => number;

  constructor(private readonly deps: ServerStoreDeps) {
    this.now = deps.now ?? Date.now;
  }

  /* ---------- plumbing ---------- */

  get ready(): boolean {
    return this.state !== null;
  }

  getSnapshot = (): ProgressState => {
    if (!this.state) throw new Error('ServerStore read before load()');
    return this.state;
  };

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(next: ProgressState) {
    this.state = next;
    for (const fn of this.listeners) fn();
  }

  /** Fetches the full snapshot (also makes the server create today's tasks). */
  load(): Promise<void> {
    this.loading ??= this.deps.api
      .progress()
      .then((p) => this.set(this.fromServer(p)))
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  private fromServer(p: PlayerProgress): ProgressState {
    let lastSection: string | null = null;
    try {
      lastSection = this.deps.storage?.getItem(LAST_SECTION_KEY) ?? null;
    } catch {
      // storage unavailable
    }
    return { ...p, v: 1, guestId: this.deps.user.id, lastSection };
  }

  /** Folds a mutation's response into the local copy. */
  private apply(u: ProgressUpdate): ActivityResult {
    const s = this.getSnapshot();
    const next: ProgressState = {
      ...s,
      stats: u.result.stats,
      daily: u.result.daily ?? s.daily,
      xpLog: [...s.xpLog, ...u.result.grants.map((g) => ({ ...g, at: u.at }))].slice(-XP_LOG_SIZE),
    };
    if (u.question) next.questions = { ...s.questions, [u.question.id]: u.question.state };
    if (u.card) next.cards = { ...s.cards, [u.card.id]: u.card.state };
    if (u.articleRead && !(u.articleRead.id in s.articlesRead)) {
      next.articlesRead = { ...s.articlesRead, [u.articleRead.id]: u.articleRead.at };
    }
    if (u.attempt) {
      const list = [u.attempt.attempt, ...(s.attempts[u.attempt.sectionId] ?? [])];
      next.attempts = { ...s.attempts, [u.attempt.sectionId]: list.slice(0, ATTEMPTS_SHOWN) };
    }
    this.set(next);
    return u.result;
  }

  /* ---------- ProgressRepo ---------- */

  setCatalog(): void {
    // Task generation happens on the server.
  }

  refreshDaily(): void {
    const s = this.state;
    if (!s?.daily) return;
    if (localDate(this.now(), s.timeZone) > s.daily.date) void this.load().catch(() => {});
  }

  async answer(
    q: QuizQuestion,
    _topicId: string,
    choice: number | null,
  ): Promise<{ check: CheckAnswerResponse; result: ActivityResult }> {
    const res = await this.deps.api.checkAnswer({ questionId: q.id, choice });
    if (!res.progress) throw new Error('Сесія закінчилась: увійди ще раз');
    const { progress, ...check } = res;
    return { check, result: this.apply(progress) };
  }

  async finishQuiz(sectionId: string, questionIds: string[]): Promise<ActivityResult> {
    return this.apply(await this.deps.api.finishQuiz(sectionId, questionIds));
  }

  async rate(card: CatalogCard, rating: number): Promise<ActivityResult & { wasDue: boolean }> {
    const prev = this.getSnapshot().cards[card.id];
    const wasDue = !prev || prev.dueAt <= this.now();
    return { ...this.apply(await this.deps.api.rateCard(card.id, rating)), wasDue };
  }

  async readArticle(articleId: string): Promise<ActivityResult> {
    return this.apply(await this.deps.api.readArticle(articleId));
  }

  async resetSection(sectionId: string, questionIds: readonly string[]): Promise<void> {
    await this.deps.api.resetSection(sectionId);
    const s = this.getSnapshot();
    const questions = { ...s.questions };
    for (const id of questionIds) delete questions[id];
    const attempts = { ...s.attempts };
    delete attempts[sectionId];
    this.set({ ...s, questions, attempts });
  }

  setLastSection(sectionId: string): void {
    const s = this.state;
    if (!s || s.lastSection === sectionId) return;
    try {
      this.deps.storage?.setItem(LAST_SECTION_KEY, sectionId);
    } catch {
      // storage unavailable
    }
    this.set({ ...s, lastSection: sectionId });
  }
}
