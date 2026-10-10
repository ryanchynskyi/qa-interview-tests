import { describe, expect, it } from 'vitest';
import type { CardProgress } from '../../src/engine/items';
import {
  chapterScores,
  dueCardIds,
  topicBadge,
  topicSkills,
  weakChapters,
  type SkillContent,
} from '../../src/engine/skill';

const now = Date.parse('2026-10-10T08:00:00Z');
const card = (rating: number, dueAt = now + 1): CardProgress => ({
  rating,
  reviews: 1,
  dueAt,
  history: [rating],
});

// Topic "sql": 4 questions in 2 chapters + 2 cards. Topic "api": untouched.
const content: SkillContent = {
  topics: [{ id: 'sql' }, { id: 'api' }],
  sections: [
    { id: 'sql', topicId: 'sql' },
    { id: 'api', topicId: 'api' },
  ],
  questions: [
    { id: 'q1', sectionId: 'sql', chapterId: 'sq-0' },
    { id: 'q2', sectionId: 'sql', chapterId: 'sq-0' },
    { id: 'q3', sectionId: 'sql', chapterId: 'sq-1' },
    { id: 'q4', sectionId: 'sql', chapterId: 'sq-1' },
    { id: 'q5', sectionId: 'api', chapterId: 'ap-0' },
  ],
  recallCards: [
    { id: 'c1', topicId: 'sql', chapterId: 'sq-0' },
    { id: 'c2', topicId: 'sql', chapterId: 'sq-1' },
    { id: 'c3', topicId: 'api', chapterId: 'ap-0' },
  ],
};

describe('topicSkills (legacy formula)', () => {
  it('averages quiz coverage and recall score', () => {
    const progress = {
      questions: { q1: 1 as const, q2: 0 as const, q3: 1 as const },
      cards: { c1: card(5) },
    };
    const [sql, api] = topicSkills(content, progress, now);
    // quiz: 2 correct of 4 total = 0.5; recall: ((5-1)/4 + 0) / 2 cards = 0.5
    expect(sql).toMatchObject({
      topicId: 'sql',
      quiz: { total: 4, correct: 2, answered: 3 },
      recall: { total: 2, rated: 1, avg: 5, score: 0.5, due: 0 },
      tested: true,
      skill: 0.5,
    });
    expect(api).toMatchObject({ tested: false, skill: 0 });
  });
});

describe('chapterScores', () => {
  it('needs ≥2 answered questions or a rated card to score a chapter', () => {
    const scores = chapterScores(content, { questions: { q3: 0 }, cards: {} }, now);
    expect(scores).toEqual([]);
  });

  it('mixes quiz accuracy and recall average, weakest first', () => {
    const progress = {
      questions: { q1: 1 as const, q2: 1 as const, q3: 0 as const, q4: 1 as const },
      cards: { c2: card(3) },
    };
    const scores = chapterScores(content, progress, now);
    expect(scores.map((s) => [s.chapterId, s.score])).toEqual([
      ['sq-1', (0.5 + 0.5) / 2],
      ['sq-0', 1],
    ]);
    expect(weakChapters(content, progress, now).map((s) => s.chapterId)).toEqual(['sq-1']);
  });
});

describe('dueCardIds', () => {
  it('lists cards whose due time has passed', () => {
    const progress = { questions: {}, cards: { c1: card(1, now), c2: card(5, now + 1) } };
    expect(dueCardIds(progress, now)).toEqual(['c1']);
    expect(topicSkills(content, progress, now)[0]?.recall.due).toBe(1);
  });
});

describe('topicBadge', () => {
  it('awards bronze, silver and gold at 60/75/90%', () => {
    expect([0, 0.59, 0.6, 0.74, 0.75, 0.89, 0.9, 1].map(topicBadge)).toEqual([
      null,
      null,
      'bronze',
      'bronze',
      'silver',
      'silver',
      'gold',
      'gold',
    ]);
  });
});
