import type { Catalog, DailyTask } from '@qa-hub/shared';

export interface TaskView {
  title: string;
  /** Where to go to work on it. */
  to: string;
}

/** Human wording and a deep link for a daily task. */
export function describeTask(task: DailyTask, catalog: Catalog): TaskView {
  const p = task.params;
  const topicName = (id?: string) => catalog.topics.find((t) => t.id === id)?.name;
  const chapter = catalog.chapters.find((c) => c.id === p.chapterId);
  const firstSectionOf = (topicId?: string) =>
    catalog.sections.find((s) => s.topicId === topicId)?.id;

  switch (task.type) {
    case 'ANSWER_N': {
      const name = topicName(p.topicId);
      return {
        title: name
          ? `Дай відповідь на ${task.target} питань з теми ${name}`
          : `Дай відповідь на ${task.target} питань у тестах`,
        to: name ? `/quiz/${firstSectionOf(p.topicId)}` : '/quiz',
      };
    }
    case 'ACCURACY':
      return {
        title: `Пройди тест із ${p.minAnswered ?? 10}+ питань на ${Math.round((p.minRatio ?? 0.8) * 100)}%+`,
        to: '/quiz',
      };
    case 'REVIEW_DUE':
      return { title: `Повтори ${task.target} карток, яким пора`, to: '/recall/due' };
    case 'READ_ARTICLE':
      return {
        title: `Прочитай статтю з розділу «${chapter?.title ?? 'Knowledge Base'}»`,
        to: chapter ? `/kb/${chapter.topicId}/${chapter.id}` : '/kb',
      };
    case 'CODE_REVIEW':
      return {
        title: `Знайди помилку в коді: ${task.target} правильні відповіді`,
        to: `/quiz/${p.sectionIds?.[0] ?? 'pwfix'}`,
      };
    case 'WEAK_SPOT': {
      const section = catalog.questions.find((q) => q.chapterId === p.chapterId)?.sectionId;
      return {
        title: `Підтягни слабкий розділ «${chapter?.title ?? '?'}»: ${task.target} відповідей або карток`,
        to: section
          ? `/quiz/${section}?ch=${p.chapterId}`
          : chapter
            ? `/kb/${chapter.topicId}/${chapter.id}`
            : '/dash',
      };
    }
  }
}
