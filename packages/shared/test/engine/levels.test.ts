import { describe, expect, it } from 'vitest';
import { levelFromXp, titleForLevel, xpAtLevel, xpToNext } from '../../src/engine/levels';

describe('level curve', () => {
  it('starts at 100 XP for the first level-up and grows', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(264);
    for (let l = 1; l < 50; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('places level boundaries exactly', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNext: 100, progress: 0 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 264 });
    expect(levelFromXp(xpAtLevel(13) - 1).level).toBe(12);
    expect(levelFromXp(xpAtLevel(13)).level).toBe(13);
  });

  it('reports progress inside a level', () => {
    expect(levelFromXp(50).progress).toBeCloseTo(0.5);
  });

  it('treats negative or fractional XP safely', () => {
    expect(levelFromXp(-10).level).toBe(1);
    expect(levelFromXp(100.9).level).toBe(2);
  });

  it('is consistent with xpAtLevel', () => {
    for (let l = 1; l <= 40; l++) expect(levelFromXp(xpAtLevel(l)).level).toBe(l);
  });
});

describe('titles', () => {
  it('maps level bands to titles', () => {
    expect(titleForLevel(1)).toBe('Trainee');
    expect(titleForLevel(3)).toBe('Junior QA');
    expect(titleForLevel(7)).toBe('Middle QA');
    expect(titleForLevel(13)).toBe('Senior QA');
    expect(titleForLevel(20)).toBe('Lead QA');
    expect(titleForLevel(30)).toBe('QA Architect');
    expect(titleForLevel(99)).toBe('QA Architect');
  });
});
