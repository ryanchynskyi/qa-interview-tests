import { describe, expect, it } from 'vitest';
import { cardId, fnv1a, questionId } from '../src/hash';

// Expected values were produced by the legacy page's own `hash()` function,
// so these tests guard compatibility with existing localStorage progress.
describe('fnv1a', () => {
  it('matches the legacy hash for ASCII', () => {
    expect(fnv1a('')).toBe('ztntfp');
    expect(fnv1a('abc')).toBe('7aigaz');
  });

  it('matches legacy question ids (Cyrillic text, empty code)', () => {
    expect(questionId('Чим WHERE відрізняється від HAVING?', '')).toBe('14ib3pe');
  });

  it('matches legacy recall card ids', () => {
    expect(cardId('Що таке реляційна база даних і що таке SQL?')).toBe('9nfc9j');
  });
});
