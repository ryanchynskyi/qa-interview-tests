/**
 * Daily tasks: three per user per local day, generated deterministically from
 * `${userKey}:${date}` and tailored to weak chapters and due recall cards.
 */
import { OK_TEXT } from '../content';
import type { ActivityEvent } from './events';
import { createRng, pick, shuffle, type Rng } from './rng';
import type { LocalDate } from './time';
import { XP_RULES } from './xp';

export const DAILY_TASK_COUNT = 3;

export type DailyTaskType =
  'ANSWER_N' | 'ACCURACY' | 'REVIEW_DUE' | 'READ_ARTICLE' | 'CODE_REVIEW' | 'WEAK_SPOT';

export interface TaskParams {
  topicId?: string;
  chapterId?: string;
  sectionIds?: string[];
  minAnswered?: number;
  minRatio?: number;
}

export interface DailyTask {
  /** `${date}:${slot}`: stable, unique per user. */
  id: string;
  date: LocalDate;
  slot: number;
  type: DailyTaskType;
  params: TaskParams;
  target: number;
  progress: number;
  rewardXp: number;
  completedAt: number | null;
}

/** Static facts about the content that generation needs. */
export interface TaskContent {
  topicIds: string[];
  /** Chapters that have at least one KB article. */
  articleChapterIds: string[];
  /** Sections made of "find the bug" questions. */
  codeReviewSectionIds: string[];
}

/** Per-user facts at generation time. */
export interface TaskSituation {
  /** Weakest first (see skill.weakChapters). */
  weakChapterIds: string[];
  dueCards: number;
}

const REWARD: Record<DailyTaskType, number> = {
  ANSWER_N: 30,
  ACCURACY: 40,
  REVIEW_DUE: 30,
  READ_ARTICLE: 20,
  CODE_REVIEW: 35,
  WEAK_SPOT: 40,
};

type Draft = Pick<DailyTask, 'type' | 'params' | 'target'>;

export function taskContentFrom(content: {
  topics: readonly { id: string }[];
  articles: readonly { chapterId: string }[];
  questions: readonly { sectionId: string; options: readonly string[] }[];
}): TaskContent {
  return {
    topicIds: content.topics.map((t) => t.id),
    articleChapterIds: [...new Set(content.articles.map((a) => a.chapterId))].sort(),
    codeReviewSectionIds: [
      ...new Set(
        content.questions.filter((q) => q.options.includes(OK_TEXT)).map((q) => q.sectionId),
      ),
    ].sort(),
  };
}

function drafts(rng: Rng, content: TaskContent, situation: TaskSituation): Draft[] {
  const priority: Draft[] = [];
  const weakTop = situation.weakChapterIds.slice(0, 3);
  if (weakTop.length) {
    priority.push({ type: 'WEAK_SPOT', params: { chapterId: pick(rng, weakTop) }, target: 5 });
  }
  if (situation.dueCards >= 3) {
    priority.push({ type: 'REVIEW_DUE', params: {}, target: Math.min(situation.dueCards, 10) });
  }

  const others: Draft[] = [
    {
      type: 'ANSWER_N',
      params:
        rng() < 0.5 && content.topicIds.length ? { topicId: pick(rng, content.topicIds) } : {},
      target: 10,
    },
    {
      type: 'ACCURACY',
      params: {
        minAnswered: XP_RULES.quizBonusMinAnswered,
        minRatio: XP_RULES.quizBonusMinRatio,
      },
      target: 1,
    },
  ];
  if (content.codeReviewSectionIds.length) {
    others.push({
      type: 'CODE_REVIEW',
      params: { sectionIds: content.codeReviewSectionIds },
      target: 3,
    });
  }
  const weakWithArticles = weakTop.filter((id) => content.articleChapterIds.includes(id));
  const readPool = weakWithArticles.length ? weakWithArticles : content.articleChapterIds;
  if (readPool.length) {
    others.push({ type: 'READ_ARTICLE', params: { chapterId: pick(rng, readPool) }, target: 1 });
  }

  return [...priority, ...shuffle(rng, others)].slice(0, DAILY_TASK_COUNT);
}

export function generateDailyTasks(
  userKey: string,
  date: LocalDate,
  content: TaskContent,
  situation: TaskSituation,
): DailyTask[] {
  const rng = createRng(`${userKey}:${date}`);
  return drafts(rng, content, situation).map((d, slot) => ({
    ...d,
    id: `${date}:${slot}`,
    date,
    slot,
    progress: 0,
    rewardXp: REWARD[d.type],
    completedAt: null,
  }));
}

/** How much `event` advances a task of this kind (0 when unrelated). */
export function taskIncrement(task: DailyTask, event: ActivityEvent): number {
  const p = task.params;
  switch (task.type) {
    case 'ANSWER_N':
      return event.type === 'answer' &&
        event.outcome !== 'skipped' &&
        (!p.topicId || p.topicId === event.topicId)
        ? 1
        : 0;
    case 'ACCURACY':
      return event.type === 'quiz_finish' &&
        event.answered >= (p.minAnswered ?? XP_RULES.quizBonusMinAnswered) &&
        event.correct / event.answered >= (p.minRatio ?? XP_RULES.quizBonusMinRatio)
        ? 1
        : 0;
    case 'REVIEW_DUE':
      return event.type === 'recall' && event.wasDue ? 1 : 0;
    case 'READ_ARTICLE':
      return event.type === 'article_read' && (!p.chapterId || p.chapterId === event.chapterId)
        ? 1
        : 0;
    case 'CODE_REVIEW':
      return event.type === 'answer' &&
        event.outcome === 'correct' &&
        (p.sectionIds ?? []).includes(event.sectionId)
        ? 1
        : 0;
    case 'WEAK_SPOT':
      return ((event.type === 'answer' && event.outcome !== 'skipped') ||
        event.type === 'recall') &&
        p.chapterId === event.chapterId
        ? 1
        : 0;
  }
}

/** Advances matching tasks; returns new task objects and the ones completed by this event. */
export function applyEventToTasks(
  tasks: readonly DailyTask[],
  event: ActivityEvent,
): { tasks: DailyTask[]; completed: DailyTask[] } {
  const completed: DailyTask[] = [];
  const next = tasks.map((t) => {
    if (t.completedAt !== null) return t;
    const inc = taskIncrement(t, event);
    if (!inc) return t;
    const progress = Math.min(t.target, t.progress + inc);
    const done = progress >= t.target;
    const updated: DailyTask = { ...t, progress, completedAt: done ? event.at : null };
    if (done) completed.push(updated);
    return updated;
  });
  return { tasks: next, completed };
}
