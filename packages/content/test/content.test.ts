import { beforeAll, describe, expect, it } from 'vitest';
import { OK_TEXT, type ContentBundle } from '@qa-hub/shared';
import { loadContent } from '../src/index';

let c: ContentBundle;
beforeAll(() => {
  c = loadContent(); // also validates every row against the zod schemas
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('extracted content', () => {
  it('has the expected volume from the legacy page', () => {
    expect(c.topics).toHaveLength(8);
    expect(c.sections).toHaveLength(10);
    expect(c.chapters).toHaveLength(91);
    expect(c.questions).toHaveLength(704);
    expect(c.recallCards).toHaveLength(166);
    expect(c.articles.length).toBeGreaterThan(0);
  });

  it('has unique ids per entity', () => {
    for (const rows of [c.topics, c.sections, c.chapters, c.articles, c.questions, c.recallCards]) {
      expect(unique(ids(rows))).toBe(true);
    }
  });

  it('has no dangling references', () => {
    const topics = new Set(ids(c.topics));
    const sections = new Set(ids(c.sections));
    const chapters = new Set(ids(c.chapters));
    expect(c.sections.every((s) => topics.has(s.topicId))).toBe(true);
    expect(c.chapters.every((ch) => topics.has(ch.topicId))).toBe(true);
    expect(c.articles.every((a) => chapters.has(a.chapterId))).toBe(true);
    expect(c.questions.every((q) => sections.has(q.sectionId) && chapters.has(q.chapterId))).toBe(
      true,
    );
    expect(c.recallCards.every((r) => topics.has(r.topicId) && chapters.has(r.chapterId))).toBe(
      true,
    );
  });

  it('keeps every question answerable with distinct options', () => {
    for (const q of c.questions) {
      expect(q.options[q.correctIndex]).toBeDefined();
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it('only uses the "code is correct" option in code-review sections', () => {
    const withOk = c.questions.filter((q) => q.options.includes(OK_TEXT));
    expect(withOk.every((q) => q.sectionId === 'pwfix' || q.sectionId === 'tsfix')).toBe(true);
  });
});
