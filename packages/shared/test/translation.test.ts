import { describe, expect, it } from 'vitest';
import {
  emptyTranslation,
  translateQuestion,
  translationIssues,
  type ContentBundle,
  type QuizQuestion,
} from '../src';

const q: QuizQuestion = {
  id: 'q1',
  sectionId: 's',
  chapterId: 'c',
  group: 'Група',
  level: 'junior',
  text: 'Що робить `x`?',
  code: '',
  options: ['а', 'б', 'в'],
};

const bundle = {
  topics: [{ id: 't', name: 'Т', order: 0 }],
  sections: [],
  chapters: [],
  articles: [
    { id: 'a1', chapterId: 'c', title: 'А', kind: 'Гайд', html: '<pre>x</pre>', order: 0 },
  ],
  questions: [{ ...q, correctIndex: 0, explanation: 'Бо `x`.', order: 0 }],
  recallCards: [],
} as unknown as ContentBundle;

describe('translateQuestion', () => {
  it('keeps options index for index and falls back per field', () => {
    const tr = emptyTranslation();
    tr.questions.q1 = { options: ['a', 'b', 'c'] };
    tr.groups['Група'] = 'Group';
    expect(translateQuestion(q, tr)).toMatchObject({
      text: q.text,
      group: 'Group',
      options: ['a', 'b', 'c'],
    });
  });

  it('ignores an option list of another length instead of shifting answers', () => {
    const tr = emptyTranslation();
    tr.questions.q1 = { options: ['a', 'b'] };
    expect(translateQuestion(q, tr).options).toEqual(q.options);
  });
});

describe('translationIssues', () => {
  it('accepts a faithful translation', () => {
    const tr = emptyTranslation();
    tr.questions.q1 = {
      text: 'What does `x` do?',
      options: ['a', 'b', 'c'],
      explanation: 'Because `x`.',
    };
    tr.articles.a1 = { title: 'A', html: '<pre>x</pre>' };
    expect(translationIssues(bundle, tr)).toEqual([]);
  });

  it('reports unknown ids, wrong option counts and lost code', () => {
    const tr = emptyTranslation();
    tr.questions.q1 = { text: 'What does x do?', options: ['a'] };
    tr.questions.nope = { text: 'x' };
    tr.articles.a1 = { html: '<p>x</p>' };
    tr.groups['Немає'] = 'None';
    expect(translationIssues(bundle, tr)).toEqual([
      'question nope: unknown id',
      'group "Немає": unknown',
      'question q1: 1 options, source has 3',
      'question q1: text has 0 code spans, source 1',
      'article a1: 0 <pre> blocks, source 1',
    ]);
  });
});
