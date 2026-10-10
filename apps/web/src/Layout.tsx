import { NavLink, Outlet, useLocation } from 'react-router';
import { levelFromXp } from '@qa-hub/shared';
import { useNow } from './lib/stores';
import { useProgress } from './progress/ProgressProvider';

const VIEWS = [
  { to: '/dash', label: 'Дашборд' },
  { to: '/quiz', label: 'Тести' },
  { to: '/recall', label: 'Active Recall' },
  { to: '/kb', label: 'Knowledge Base' },
];

function LevelChip() {
  const { stats } = useProgress();
  const lvl = levelFromXp(stats.totalXp);
  return (
    <div className="lvlchip" data-testid="level">
      <span>
        <b>
          Рівень {lvl.level} · {lvl.title}
        </b>
      </span>
      <div className="lvlbar" aria-hidden>
        <span style={{ width: `${lvl.progress * 100}%`, background: 'var(--accent)' }} />
      </div>
      <span>
        {lvl.xpIntoLevel} / {lvl.xpForNext} XP · усього {stats.totalXp}
      </span>
    </div>
  );
}

export function Layout() {
  const progress = useProgress();
  const { pathname } = useLocation();
  const now = useNow();
  const due = Object.values(progress.cards).filter((c) => c.dueAt <= now).length;
  const section = pathname.split('/')[1] || 'dash';

  return (
    <div className="wrap">
      <div className="head">
        <div>
          <h1>QA Interview Hub</h1>
          <p className="sub">
            Тести, Active Recall і база знань для співбесіди Senior QA Automation. Дашборд показує,
            наскільки прокачана кожна тема: половина оцінки з тестів, половина з чесної самооцінки в
            Active Recall.
          </p>
        </div>
        <LevelChip />
      </div>
      <p className="guest">Гостьовий режим: прогрес зберігається лише в цьому браузері.</p>
      <nav className="views" aria-label="Розділи">
        {VIEWS.map((v) => (
          // NavLink sets aria-current="page", which the legacy CSS already styles.
          <NavLink key={v.to} to={v.to}>
            {v.label}
            {v.to === '/recall' && due > 0 && <span className="cnt">{due}</span>}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>
        <span className="note">
          {section === 'quiz'
            ? '1–4 відповідь, S або 0 пропуск, Enter далі.'
            : section === 'recall'
              ? 'Пробіл показати відповідь, 1–5 оцінка.'
              : ''}
        </span>
      </footer>
    </div>
  );
}
