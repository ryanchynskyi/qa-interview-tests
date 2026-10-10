/** XP needed to go from `level` to `level + 1`. Level 1 → 2 takes 100 XP. */
export function xpToNext(level: number): number {
  return Math.round(100 * Math.pow(level, 1.4));
}

/** Total XP at which `level` is reached (level 1 starts at 0). */
export function xpAtLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level needs in total to reach the next one. */
  xpForNext: number;
  /** 0..1 progress towards the next level. */
  progress: number;
}

/**
 * Title bands. Roughly: Junior within the first week of daily practice,
 * Middle after a month, Senior after ~2 months of steady use.
 */
export const LEVEL_TITLES: readonly { from: number; title: string }[] = [
  { from: 1, title: 'Trainee' },
  { from: 3, title: 'Junior QA' },
  { from: 7, title: 'Middle QA' },
  { from: 13, title: 'Senior QA' },
  { from: 20, title: 'Lead QA' },
  { from: 30, title: 'QA Architect' },
];

export function titleForLevel(level: number): string {
  let title = LEVEL_TITLES[0]!.title;
  for (const band of LEVEL_TITLES) if (level >= band.from) title = band.title;
  return title;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let floor = 0;
  while (xp >= floor + xpToNext(level)) {
    floor += xpToNext(level);
    level++;
  }
  const xpForNext = xpToNext(level);
  const xpIntoLevel = xp - floor;
  return {
    level,
    title: titleForLevel(level),
    xpIntoLevel,
    xpForNext,
    progress: xpIntoLevel / xpForNext,
  };
}
