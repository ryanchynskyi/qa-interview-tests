import { useEffect } from 'react';
import { titleForLevel, type ActivityResult, type Catalog } from '@qa-hub/shared';
import { getMessages, type Messages } from '../i18n';
import { createStore } from './stores';
import { describeTask } from './tasks';

export interface Toast {
  id: number;
  text: string;
  tone: 'xp' | 'level';
}

const toastStore = createStore<Toast[]>([]);
let nextId = 1;
const LIFETIME_MS = 4000;

export function toast(text: string, tone: Toast['tone'] = 'xp') {
  const id = nextId++;
  toastStore.set((list) => [...list.slice(-3), { id, text, tone }]);
  window.setTimeout(() => toastStore.set((list) => list.filter((t) => t.id !== id)), LIFETIME_MS);
}

/**
 * What deserves a notification: completed tasks, bonuses, streaks and level-ups.
 * Plain answer/recall XP already shows inline next to the answer, so it's skipped here.
 */
export function activityMessages(
  r: ActivityResult,
  catalog: Catalog | undefined,
  m: Messages = getMessages(),
): { text: string; tone: Toast['tone'] }[] {
  const out: { text: string; tone: Toast['tone'] }[] = [];
  for (const t of r.completedTasks) {
    const name = catalog ? describeTask(t, catalog, m).title : m.tasks.daily;
    out.push({ text: m.toasts.taskDone(name, t.rewardXp), tone: 'xp' });
  }
  for (const g of r.grants) {
    if (g.reason === 'daily_all_done') out.push({ text: m.toasts.allDone(g.amount), tone: 'xp' });
    if (g.reason === 'streak')
      out.push({ text: m.toasts.streak(r.stats.streak, g.amount), tone: 'xp' });
    if (g.reason === 'quiz_bonus') out.push({ text: m.toasts.quizBonus(g.amount), tone: 'xp' });
  }
  if (r.levelUp) {
    out.push({
      text: m.toasts.levelUp(r.levelUp.to, titleForLevel(r.levelUp.to)),
      tone: 'level',
    });
  }
  return out;
}

/** Turns store activity into toasts. */
export function useActivityToasts(
  subscribe: (fn: (r: ActivityResult) => void) => () => void,
  catalog: Catalog | undefined,
) {
  useEffect(
    () => subscribe((r) => activityMessages(r, catalog).forEach((m) => toast(m.text, m.tone))),
    [subscribe, catalog],
  );
}

export function Toasts() {
  const toasts = toastStore.use();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
