import { describe, expect, it } from 'vitest';
import { OK_TEXT } from '../../src/content';
import {
  applyEventToTasks,
  generateDailyTasks,
  taskContentFrom,
  taskIncrement,
  type DailyTask,
  type TaskContent,
} from '../../src/engine/daily-tasks';
import type { ActivityEvent } from '../../src/engine/events';

const content: TaskContent = {
  topicIds: ['playwright', 'sql', 'api'],
  articleChapterIds: ['pw-0', 'sq-0', 'sq-1'],
  codeReviewSectionIds: ['pwfix', 'tsfix'],
};
const fresh = { weakChapterIds: [], dueCards: 0 };
const at = Date.parse('2026-10-10T08:00:00Z');

const answer = (over: Partial<Extract<ActivityEvent, { type: 'answer' }>> = {}): ActivityEvent => ({
  type: 'answer',
  at,
  questionId: 'q',
  sectionId: 'sql',
  topicId: 'sql',
  chapterId: 'sq-0',
  outcome: 'correct',
  ...over,
});
const task = (over: Partial<DailyTask>): DailyTask => ({
  id: '2026-10-10:0',
  date: '2026-10-10',
  slot: 0,
  type: 'ANSWER_N',
  params: {},
  target: 2,
  progress: 0,
  rewardXp: 30,
  completedAt: null,
  ...over,
});

describe('generateDailyTasks', () => {
  it('creates 3 distinct tasks with stable ids', () => {
    const tasks = generateDailyTasks('user-1', '2026-10-10', content, fresh);
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.type)).size).toBe(3);
    expect(tasks.map((t) => t.id)).toEqual(['2026-10-10:0', '2026-10-10:1', '2026-10-10:2']);
    expect(tasks.every((t) => t.progress === 0 && t.completedAt === null && t.rewardXp > 0)).toBe(
      true,
    );
  });

  it('is deterministic for the same user and day', () => {
    expect(generateDailyTasks('user-1', '2026-10-10', content, fresh)).toEqual(
      generateDailyTasks('user-1', '2026-10-10', content, fresh),
    );
  });

  it('varies across days and users', () => {
    const sig = (user: string, date: string) =>
      JSON.stringify(generateDailyTasks(user, date, content, fresh).map((t) => [t.type, t.params]));
    const days = new Set(Array.from({ length: 14 }, (_, i) => sig('user-1', `2026-10-${10 + i}`)));
    const users = new Set(Array.from({ length: 14 }, (_, i) => sig(`user-${i}`, '2026-10-10')));
    expect(days.size).toBeGreaterThan(3);
    expect(users.size).toBeGreaterThan(3);
  });

  it('prioritises weak chapters and due cards', () => {
    const tasks = generateDailyTasks('user-1', '2026-10-10', content, {
      weakChapterIds: ['sq-1', 'pw-0', 'ap-3', 'ts-9'],
      dueCards: 25,
    });
    expect(tasks[0]).toMatchObject({ type: 'WEAK_SPOT', target: 5 });
    expect(['sq-1', 'pw-0', 'ap-3']).toContain(tasks[0]!.params.chapterId);
    expect(tasks[1]).toMatchObject({ type: 'REVIEW_DUE', target: 10 });
  });

  it('never asks to review cards when fewer than 3 are due', () => {
    for (let d = 10; d < 30; d++) {
      const tasks = generateDailyTasks('u', `2026-10-${d}`, content, {
        weakChapterIds: [],
        dueCards: 2,
      });
      expect(tasks.some((t) => t.type === 'REVIEW_DUE')).toBe(false);
    }
  });

  it('points article tasks at weak chapters when they have articles', () => {
    for (let d = 10; d < 30; d++) {
      const tasks = generateDailyTasks('u', `2026-10-${d}`, content, {
        weakChapterIds: ['sq-1'],
        dueCards: 0,
      });
      const read = tasks.find((t) => t.type === 'READ_ARTICLE');
      if (read) expect(read.params.chapterId).toBe('sq-1');
    }
  });

  it('skips code-review tasks when the content has none', () => {
    for (let d = 10; d < 30; d++) {
      const tasks = generateDailyTasks(
        'u',
        `2026-10-${d}`,
        { ...content, codeReviewSectionIds: [] },
        fresh,
      );
      expect(tasks.some((t) => t.type === 'CODE_REVIEW')).toBe(false);
    }
  });
});

describe('taskContentFrom', () => {
  it('derives topics, article chapters and code-review sections', () => {
    expect(
      taskContentFrom({
        topics: [{ id: 'sql' }],
        articles: [{ chapterId: 'sq-1' }, { chapterId: 'sq-0' }, { chapterId: 'sq-1' }],
        questions: [
          { sectionId: 'sql', options: ['a', 'b'] },
          { sectionId: 'tsfix', options: ['a', OK_TEXT] },
        ],
      }),
    ).toEqual({
      topicIds: ['sql'],
      articleChapterIds: ['sq-0', 'sq-1'],
      codeReviewSectionIds: ['tsfix'],
    });
  });
});

describe('taskIncrement', () => {
  it('ANSWER_N counts answered (not skipped) questions, optionally per topic', () => {
    expect(taskIncrement(task({ type: 'ANSWER_N' }), answer())).toBe(1);
    expect(taskIncrement(task({ type: 'ANSWER_N' }), answer({ outcome: 'wrong' }))).toBe(1);
    expect(taskIncrement(task({ type: 'ANSWER_N' }), answer({ outcome: 'skipped' }))).toBe(0);
    expect(taskIncrement(task({ type: 'ANSWER_N', params: { topicId: 'api' } }), answer())).toBe(0);
  });

  it('ACCURACY needs a finished quiz with ≥10 answers at ≥80%', () => {
    const t = task({ type: 'ACCURACY', params: { minAnswered: 10, minRatio: 0.8 } });
    const fin = (answered: number, correct: number): ActivityEvent => ({
      type: 'quiz_finish',
      at,
      sectionId: 'sql',
      answered,
      correct,
    });
    expect(taskIncrement(t, fin(10, 8))).toBe(1);
    expect(taskIncrement(t, fin(10, 7))).toBe(0);
    expect(taskIncrement(t, fin(9, 9))).toBe(0);
  });

  it('REVIEW_DUE counts only due recall reviews', () => {
    const rc = (wasDue: boolean): ActivityEvent => ({
      type: 'recall',
      at,
      cardId: 'c',
      topicId: 'sql',
      chapterId: 'sq-0',
      rating: 4,
      wasDue,
    });
    expect(taskIncrement(task({ type: 'REVIEW_DUE' }), rc(true))).toBe(1);
    expect(taskIncrement(task({ type: 'REVIEW_DUE' }), rc(false))).toBe(0);
  });

  it('READ_ARTICLE counts reads in its chapter', () => {
    const read = (chapterId: string): ActivityEvent => ({
      type: 'article_read',
      at,
      articleId: `${chapterId}:0`,
      topicId: 'sql',
      chapterId,
    });
    const t = task({ type: 'READ_ARTICLE', params: { chapterId: 'sq-1' } });
    expect(taskIncrement(t, read('sq-1'))).toBe(1);
    expect(taskIncrement(t, read('sq-0'))).toBe(0);
  });

  it('CODE_REVIEW counts correct answers in code-review sections', () => {
    const t = task({ type: 'CODE_REVIEW', params: { sectionIds: ['pwfix', 'tsfix'] } });
    expect(taskIncrement(t, answer({ sectionId: 'pwfix' }))).toBe(1);
    expect(taskIncrement(t, answer({ sectionId: 'pwfix', outcome: 'wrong' }))).toBe(0);
    expect(taskIncrement(t, answer({ sectionId: 'sql' }))).toBe(0);
  });

  it('WEAK_SPOT counts answers and recall in its chapter', () => {
    const t = task({ type: 'WEAK_SPOT', params: { chapterId: 'sq-0' } });
    expect(taskIncrement(t, answer({ outcome: 'wrong' }))).toBe(1);
    expect(taskIncrement(t, answer({ chapterId: 'sq-1' }))).toBe(0);
    expect(
      taskIncrement(t, {
        type: 'recall',
        at,
        cardId: 'c',
        topicId: 'sql',
        chapterId: 'sq-0',
        rating: 2,
        wasDue: false,
      }),
    ).toBe(1);
  });
});

describe('applyEventToTasks', () => {
  it('advances, completes once, and caps at the target', () => {
    let tasks = [task({ target: 2 })];
    let r = applyEventToTasks(tasks, answer());
    expect(r.tasks[0]).toMatchObject({ progress: 1, completedAt: null });
    expect(r.completed).toEqual([]);

    r = applyEventToTasks(r.tasks, answer());
    expect(r.tasks[0]).toMatchObject({ progress: 2, completedAt: at });
    expect(r.completed).toHaveLength(1);

    tasks = r.tasks;
    r = applyEventToTasks(tasks, answer());
    expect(r.tasks[0]).toBe(tasks[0]); // untouched once complete
    expect(r.completed).toEqual([]);
  });

  it('does not mutate its input', () => {
    const tasks = [task({})];
    const copy = structuredClone(tasks);
    applyEventToTasks(tasks, answer());
    expect(tasks).toEqual(copy);
  });
});
