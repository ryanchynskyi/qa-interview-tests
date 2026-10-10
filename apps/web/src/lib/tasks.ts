import type { Catalog, DailyTask } from '@qa-hub/shared';
import { getMessages, type Messages } from '../i18n';

export interface TaskView {
  title: string;
  /** Where to go to work on it. */
  to: string;
}

/** Human wording and a deep link for a daily task. */
export function describeTask(
  task: DailyTask,
  catalog: Catalog,
  m: Messages = getMessages(),
): TaskView {
  const p = task.params;
  const t = m.tasks;
  const topicName = (id?: string) => catalog.topics.find((t) => t.id === id)?.name;
  const chapter = catalog.chapters.find((c) => c.id === p.chapterId);
  const firstSectionOf = (topicId?: string) =>
    catalog.sections.find((s) => s.topicId === topicId)?.id;

  switch (task.type) {
    case 'ANSWER_N': {
      const name = topicName(p.topicId);
      return {
        title: name ? t.answerTopic(task.target, name) : t.answer(task.target),
        to: name ? `/quiz/${firstSectionOf(p.topicId)}` : '/quiz',
      };
    }
    case 'ACCURACY':
      return {
        title: t.accuracy(p.minAnswered ?? 10, Math.round((p.minRatio ?? 0.8) * 100)),
        to: '/quiz',
      };
    case 'REVIEW_DUE':
      return { title: t.review(task.target), to: '/recall/due' };
    case 'READ_ARTICLE':
      return {
        title: t.read(chapter?.title ?? 'Knowledge Base'),
        to: chapter ? `/kb/${chapter.topicId}/${chapter.id}` : '/kb',
      };
    case 'CODE_REVIEW':
      return {
        title: t.codeReview(task.target),
        to: `/quiz/${p.sectionIds?.[0] ?? 'pwfix'}`,
      };
    case 'WEAK_SPOT': {
      const section = catalog.questions.find((q) => q.chapterId === p.chapterId)?.sectionId;
      return {
        title: t.weakSpot(chapter?.title ?? '?', task.target),
        to: section
          ? `/quiz/${section}?ch=${p.chapterId}`
          : chapter
            ? `/kb/${chapter.topicId}/${chapter.id}`
            : '/dash',
      };
    }
  }
}
