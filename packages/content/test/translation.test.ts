import { describe, expect, it } from 'vitest';
import { translationIssues } from '@qa-hub/shared';
import { loadContent, loadTranslation } from '../src/index';

describe('English overlay', () => {
  it('parses and matches the source: known ids, same option counts, code kept', () => {
    // loadTranslation validates the files' shape; translationIssues checks them against
    // the Ukrainian source. Untranslated entries are fine (they fall back to Ukrainian).
    expect(translationIssues(loadContent(), loadTranslation('en'))).toEqual([]);
  });
});
