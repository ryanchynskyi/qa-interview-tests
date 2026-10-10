import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './RouteError';

describe('isChunkLoadError', () => {
  it('recognises a failed view chunk in Safari, Chrome and Firefox', () => {
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(
      isChunkLoadError(
        new TypeError('Failed to fetch dynamically imported module: https://x/assets/Quiz-a1.js'),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
  });

  it('leaves other errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError({ status: 404 })).toBe(false);
  });
});
