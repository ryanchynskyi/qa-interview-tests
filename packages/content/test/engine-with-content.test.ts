import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyAnswer,
  generateDailyTasks,
  taskContentFrom,
  topicSkills,
  weakChapters,
  type QuestionProgress,
} from '@qa-hub/shared';
import { loadContent } from '../src/index';

const c = loadContent();
const now = Date.parse('2026-10-10T08:00:00Z');

describe('engine on the real content', () => {
  const tc = taskContentFrom(c);

  it('derives task content from the bundle', () => {
    expect(tc.topicIds).toHaveLength(8);
    expect(tc.codeReviewSectionIds).toEqual(['pwfix', 'tsfix']);
    expect(tc.articleChapterIds.length).toBeGreaterThan(0);
  });

  it('only generates tasks that point at existing content (60 days × 5 users)', () => {
    const chapters = new Set(c.chapters.map((ch) => ch.id));
    const topics = new Set(c.topics.map((t) => t.id));
    const sections = new Set(c.sections.map((s) => s.id));
    const weak = c.chapters.slice(0, 5).map((ch) => ch.id);
    for (let u = 0; u < 5; u++) {
      for (let d = 0; d < 60; d++) {
        const date = addDays('2026-10-10', d);
        const tasks = generateDailyTasks(`user-${u}`, date, tc, {
          weakChapterIds: d % 2 ? weak : [],
          dueCards: d % 3 ? 12 : 0,
        });
        expect(tasks).toHaveLength(3);
        for (const t of tasks) {
          if (t.params.chapterId) expect(chapters.has(t.params.chapterId)).toBe(true);
          if (t.params.topicId) expect(topics.has(t.params.topicId)).toBe(true);
          for (const s of t.params.sectionIds ?? []) expect(sections.has(s)).toBe(true);
        }
      }
    }
  });

  it('scores a learner who aced one topic', () => {
    const progress: Record<string, QuestionProgress> = {};
    let xp = 0;
    for (const q of c.questions.filter((q) => q.sectionId === 'sql')) {
      const r = applyAnswer(
        undefined,
        { questionId: q.id, level: q.level, outcome: 'correct' },
        {
          now,
          timeZone: 'Europe/Kyiv',
        },
      );
      progress[q.id] = r.next;
      xp += r.grants.reduce((s, g) => s + g.amount, 0);
    }
    const results = Object.fromEntries(
      Object.entries(progress).map(([id, p]) => [id, p.lastResult]),
    );
    const skills = topicSkills(c, { questions: results, cards: {} }, now);
    const sql = skills.find((s) => s.topicId === 'sql')!;
    expect(sql.quiz).toMatchObject({ correct: 65, answered: 65, total: 65 });
    expect(sql.skill).toBe(0.5); // full quiz marks, no recall yet
    expect(skills.filter((s) => s.tested)).toHaveLength(1);
    expect(xp).toBeGreaterThan(65 * 5);
    expect(weakChapters(c, { questions: results, cards: {} }, now)).toEqual([]);
  });
});
