import { describe, expect, it } from 'vitest';
import type { Catalog, DailyTask } from '@qa-hub/shared';
import { describeTask } from './tasks';

const catalog: Catalog = {
  topics: [{ id: 'sql', name: 'SQL', order: 0 }],
  sections: [
    {
      id: 'sql',
      topicId: 'sql',
      name: 'SQL',
      description: '',
      order: 0,
      questionCount: 1,
      codeReview: false,
    },
  ],
  chapters: [
    { id: 'sq-1', topicId: 'sql', title: 'JOIN', subtitle: '', order: 0, articleCount: 3 },
  ],
  questions: [{ id: 'q', sectionId: 'sql', chapterId: 'sq-1', group: 'JOIN', level: 'junior' }],
  recallCards: [],
};
const task = (over: Partial<DailyTask>): DailyTask => ({
  id: 'd:0',
  date: '2026-10-10',
  slot: 0,
  type: 'ANSWER_N',
  params: {},
  target: 10,
  progress: 0,
  rewardXp: 30,
  completedAt: null,
  ...over,
});

describe('describeTask', () => {
  it('words each task type and links to where it is done', () => {
    expect(describeTask(task({ params: { topicId: 'sql' } }), catalog)).toEqual({
      title: 'Дай відповідь на 10 питань з теми SQL',
      to: '/quiz/sql',
    });
    expect(describeTask(task({}), catalog).to).toBe('/quiz');
    expect(
      describeTask(task({ type: 'ACCURACY', params: { minAnswered: 10, minRatio: 0.8 } }), catalog)
        .title,
    ).toBe('Пройди тест із 10+ питань на 80%+');
    expect(describeTask(task({ type: 'REVIEW_DUE', target: 5 }), catalog)).toEqual({
      title: 'Повтори 5 карток, яким пора',
      to: '/recall/due',
    });
    expect(
      describeTask(task({ type: 'READ_ARTICLE', params: { chapterId: 'sq-1' } }), catalog),
    ).toEqual({
      title: 'Прочитай статтю з розділу «JOIN»',
      to: '/kb/sql/sq-1',
    });
    expect(
      describeTask(task({ type: 'WEAK_SPOT', target: 5, params: { chapterId: 'sq-1' } }), catalog)
        .to,
    ).toBe('/quiz/sql?ch=sq-1');
    expect(
      describeTask(
        task({ type: 'CODE_REVIEW', target: 3, params: { sectionIds: ['tsfix'] } }),
        catalog,
      ).to,
    ).toBe('/quiz/tsfix');
  });
});
