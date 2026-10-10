import { Link } from 'react-router';
import {
  currentStreak,
  localDate,
  msUntilNextLocalDay,
  XP_RULES,
  type Catalog,
} from '@qa-hub/shared';
import { useT, type Messages } from '../i18n';
import { useNow } from '../lib/stores';
import { describeTask } from '../lib/tasks';
import { useProgress } from '../progress/ProgressProvider';

function untilMidnight(ms: number, t: Messages): string {
  const min = Math.max(0, Math.ceil(ms / 60_000));
  return t.today.duration(Math.floor(min / 60), min % 60);
}

/** Today's three tasks as a test-run report, the streak, and when the next set arrives. */
export function TodayCard({ catalog }: { catalog: Catalog }) {
  const { daily, stats, timeZone } = useProgress();
  const t = useT();
  const now = useNow(30_000);
  const today = localDate(now, timeZone);
  if (!daily || daily.date !== today) return null;

  const done = daily.tasks.filter((x) => x.completedAt !== null).length;
  const running = daily.tasks.filter((x) => x.completedAt === null && x.progress > 0).length;
  const streak = currentStreak(stats, today);
  const keptToday = stats.lastActiveDate === today;

  return (
    <section className="card today" data-testid="today">
      <div className="today-head">
        <h2>{t.today.title(done, daily.tasks.length)}</h2>
        <span className="note mono">
          {t.today.reset(untilMidnight(msUntilNextLocalDay(now, timeZone), t))}
        </span>
      </div>
      <ul className="tasks">
        {daily.tasks.map((task) => {
          const view = describeTask(task, catalog, t);
          const isDone = task.completedAt !== null;
          const status = isDone ? 'pass' : task.progress > 0 ? 'run' : 'todo';
          return (
            <li className={`task ${status}`} key={task.id} data-testid="task">
              <span className="st">
                {isDone ? '✓ PASS' : task.progress > 0 ? '◌ RUN' : '○ TODO'}
              </span>
              <span className="t">{view.title}</span>
              <span className="meta2">
                {task.progress}/{task.target} · +{task.rewardXp} XP
              </span>
              <span className="lvlbar" aria-hidden>
                <span style={{ width: `${(task.progress / task.target) * 100}%` }} />
              </span>
              {!isDone && (
                <Link className="btn sm go" to={view.to}>
                  {t.common.start}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <p className="runline">
        <span className="ok">{t.today.passed(done)}</span>
        {running > 0 && (
          <>
            , <span className="warn">{t.today.running(running)}</span>
          </>
        )}{' '}
        · {t.today.total(daily.tasks.length)}
      </p>
      <p className="note">
        {streak > 0
          ? keptToday
            ? t.today.streakKept(streak)
            : t.today.streakKeep(streak)
          : t.today.streakStart}{' '}
        {done === daily.tasks.length ? t.today.allDone : t.today.bonus(XP_RULES.dailyAllDone)}
      </p>
    </section>
  );
}
