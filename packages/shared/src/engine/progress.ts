/**
 * Player-level bookkeeping: total XP, level-ups, streaks, the daily task set and
 * its bonuses. Item-level XP (answers, recall, articles) comes in as `itemGrants`.
 */
import { applyEventToTasks, type DailyTask } from './daily-tasks';
import type { ActivityEvent } from './events';
import { levelFromXp } from './levels';
import { addDays, localDate, type LocalDate } from './time';
import { XP_RULES, streakBonus, sumXp, type XpGrant } from './xp';

export interface PlayerStats {
  totalXp: number;
  streak: number;
  longestStreak: number;
  /** Last local date on which at least one daily task was completed. */
  lastActiveDate: LocalDate | null;
}

export interface DailyState {
  date: LocalDate;
  tasks: DailyTask[];
}

export const newPlayerStats = (): PlayerStats => ({
  totalXp: 0,
  streak: 0,
  longestStreak: 0,
  lastActiveDate: null,
});

/**
 * Today's task set: keeps the current one unless `today` is a later date.
 * Never moving backwards also means switching to a time zone where it is still
 * "yesterday" (or the same day) cannot produce a second set of tasks.
 */
export function ensureDaily(
  current: DailyState | null,
  today: LocalDate,
  generate: (date: LocalDate) => DailyTask[],
): DailyState {
  if (current && today <= current.date) return current;
  return { date: today, tasks: generate(today) };
}

/** Streak to display: it lapses once a whole local day passes without a completed task. */
export function currentStreak(stats: PlayerStats, today: LocalDate): number {
  if (!stats.lastActiveDate) return 0;
  return stats.lastActiveDate === today || stats.lastActiveDate === addDays(today, -1)
    ? stats.streak
    : 0;
}

/** Counts `date` as an active day. `grew` is false when it was already counted. */
export function advanceStreak(
  stats: PlayerStats,
  date: LocalDate,
): { stats: PlayerStats; grew: boolean } {
  if (stats.lastActiveDate && date <= stats.lastActiveDate) return { stats, grew: false };
  const streak = stats.lastActiveDate === addDays(date, -1) ? stats.streak + 1 : 1;
  return {
    stats: {
      ...stats,
      streak,
      longestStreak: Math.max(stats.longestStreak, streak),
      lastActiveDate: date,
    },
    grew: true,
  };
}

export interface ActivityResult {
  stats: PlayerStats;
  daily: DailyState | null;
  /** Item grants plus task, all-done and streak bonuses, in that order. */
  grants: XpGrant[];
  xpGained: number;
  levelUp: { from: number; to: number } | null;
  completedTasks: DailyTask[];
}

export function recordActivity(input: {
  stats: PlayerStats;
  daily: DailyState | null;
  event: ActivityEvent;
  itemGrants: readonly XpGrant[];
  timeZone: string;
}): ActivityResult {
  const { event, timeZone } = input;
  let stats = input.stats;
  let daily = input.daily;
  const grants: XpGrant[] = [...input.itemGrants];
  let completedTasks: DailyTask[] = [];

  const eventDate = localDate(event.at, timeZone);
  if (daily && daily.date === eventDate) {
    const wasAllDone = daily.tasks.every((t) => t.completedAt !== null);
    const applied = applyEventToTasks(daily.tasks, event);
    daily = { ...daily, tasks: applied.tasks };
    completedTasks = applied.completed;

    for (const t of completedTasks) {
      grants.push({ amount: t.rewardXp, reason: 'daily_task', refId: t.id });
    }
    if (completedTasks.length && !wasAllDone && daily.tasks.every((t) => t.completedAt !== null)) {
      grants.push({ amount: XP_RULES.dailyAllDone, reason: 'daily_all_done', refId: daily.date });
    }
    if (completedTasks.length) {
      const advanced = advanceStreak(stats, eventDate);
      stats = advanced.stats;
      if (advanced.grew) grants.push({ ...streakBonus(stats.streak), refId: eventDate });
    }
  }

  const xpGained = sumXp(grants);
  const before = levelFromXp(stats.totalXp).level;
  stats = { ...stats, totalXp: stats.totalXp + xpGained };
  const after = levelFromXp(stats.totalXp).level;

  return {
    stats,
    daily,
    grants,
    xpGained,
    levelUp: after > before ? { from: before, to: after } : null,
    completedTasks,
  };
}
