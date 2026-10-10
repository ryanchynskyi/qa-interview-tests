import { Link } from 'react-router';
import {
  currentStreak,
  localDate,
  msUntilNextLocalDay,
  XP_RULES,
  type Catalog,
} from '@qa-hub/shared';
import { useNow } from '../lib/stores';
import { describeTask } from '../lib/tasks';
import { useProgress } from '../progress/ProgressProvider';

function untilMidnight(ms: number): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(min / 60);
  return h ? `${h} год ${min % 60} хв` : `${min} хв`;
}

/** Today's three tasks, the streak, and when the next set arrives (local midnight). */
export function TodayCard({ catalog }: { catalog: Catalog }) {
  const { daily, stats, timeZone } = useProgress();
  const now = useNow(30_000);
  const today = localDate(now, timeZone);
  if (!daily || daily.date !== today) return null;

  const done = daily.tasks.filter((t) => t.completedAt !== null).length;
  const streak = currentStreak(stats, today);
  const keptToday = stats.lastActiveDate === today;

  return (
    <section className="card today" data-testid="today">
      <div className="head">
        <h2 style={{ margin: 0 }}>
          Сьогодні: {done} з {daily.tasks.length}
        </h2>
        <span className="note">
          Нові завдання через {untilMidnight(msUntilNextLocalDay(now, timeZone))}
        </span>
      </div>
      <p className="note" style={{ margin: '6px 0 4px' }}>
        {streak > 0
          ? keptToday
            ? `Серія ${streak} дн. поспіль: сьогодні вже зараховано.`
            : `Серія ${streak} дн. поспіль: виконай хоча б одне завдання сьогодні, щоб її не втратити.`
          : 'Виконай хоча б одне завдання, щоб почати серію днів.'}{' '}
        {done === daily.tasks.length
          ? 'Усі завдання виконано!'
          : `За всі три: ще +${XP_RULES.dailyAllDone} XP бонусом.`}
      </p>
      {daily.tasks.map((t) => {
        const view = describeTask(t, catalog);
        const isDone = t.completedAt !== null;
        return (
          <div className={`task${isDone ? ' done' : ''}`} key={t.id} data-testid="task">
            <span className="t">{view.title}</span>
            <div className="lvlbar" aria-hidden>
              <span
                style={{
                  width: `${(t.progress / t.target) * 100}%`,
                  background: isDone ? 'var(--ok)' : 'var(--accent)',
                }}
              />
            </div>
            <span className="meta2">
              {t.progress} / {t.target} · +{t.rewardXp} XP{isDone ? ' · виконано' : ''}
            </span>
            {!isDone && (
              <Link className="btn sm go" to={view.to}>
                Почати
              </Link>
            )}
          </div>
        );
      })}
    </section>
  );
}
