import type {
  ActivityResult,
  Catalog,
  CatalogCard,
  CheckAnswerResponse,
  PlayerProgress,
  QuizQuestion,
} from '@qa-hub/shared';

/** What the UI reads. Guests and signed-in users share this shape. */
export interface ProgressState extends PlayerProgress {
  v: 1;
  /** Guest id, or the user id when signed in; seeds guest daily tasks. */
  guestId: string;
  lastSection: string | null;
}

/**
 * Where progress lives: localStorage for guests (GuestStore), the API for signed-in
 * users (ServerStore). Views only talk to this interface.
 */
export interface ProgressRepo {
  readonly kind: 'guest' | 'server';
  getSnapshot(): ProgressState;
  subscribe(fn: () => void): () => void;
  setCatalog(catalog: Catalog): void;
  /** New local day → new tasks. */
  refreshDaily(): void;
  answer(
    q: QuizQuestion,
    topicId: string,
    choice: number | null,
  ): Promise<{ check: CheckAnswerResponse; result: ActivityResult }>;
  /** End of a run; correctness is taken from stored answers. */
  finishQuiz(sectionId: string, questionIds: string[]): Promise<ActivityResult>;
  rate(card: CatalogCard, rating: number): Promise<ActivityResult & { wasDue: boolean }>;
  readArticle(articleId: string, chapterId: string, topicId: string): Promise<ActivityResult>;
  resetSection(sectionId: string, questionIds: readonly string[]): Promise<void>;
  setLastSection(sectionId: string): void;
}
