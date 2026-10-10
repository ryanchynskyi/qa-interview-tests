import { useCallback } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { currentStreak, levelFromXp, localDate, type ActivityResult } from '@qa-hub/shared';
import { useAuth } from './auth/AuthProvider';
import { useCatalog } from './hooks/content';
import { useNow } from './lib/stores';
import { Toasts, useActivityToasts } from './lib/toasts';
import { useProgress, useStore } from './progress/ProgressProvider';
import { ImportBanner } from './views/ImportBanner';

const VIEWS = [
  { to: '/dash', label: 'Дашборд' },
  { to: '/quiz', label: 'Тести' },
  { to: '/recall', label: 'Active Recall' },
  { to: '/kb', label: 'Knowledge Base' },
];

function LevelChip() {
  const { stats, timeZone } = useProgress();
  const now = useNow();
  const lvl = levelFromXp(stats.totalXp);
  const streak = currentStreak(stats, localDate(now, timeZone));
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
      <span data-testid="streak" title={`Найдовша серія: ${stats.longestStreak} дн.`}>
        {streak > 0 ? `Серія: ${streak} дн. поспіль` : 'Серії поки немає: виконай завдання дня'}
      </span>
      <Link to="/profile" className="golink" style={{ marginTop: 0 }}>
        Профіль →
      </Link>
    </div>
  );
}

function Account() {
  const { state, logout } = useAuth();
  const { pathname } = useLocation();
  if (state.status !== 'user') {
    if (pathname === '/login' || pathname === '/register') return null;
    return (
      <p className="guest">
        Гостьовий режим: прогрес зберігається лише в цьому браузері.{' '}
        <Link to={`/login?next=${encodeURIComponent(pathname)}`}>Увійти</Link> або{' '}
        <Link to={`/register?next=${encodeURIComponent(pathname)}`}>створити акаунт</Link>, щоб
        зберігати прогрес на сервері.
      </p>
    );
  }
  return (
    <p className="guest" data-testid="account">
      Привіт, <Link to="/profile">{state.user.displayName}</Link> · прогрес зберігається в акаунті (
      {state.user.email}).{' '}
      <button type="button" className="linkbtn" onClick={() => void logout()}>
        Вийти
      </button>
    </p>
  );
}

export function Layout() {
  const progress = useProgress();
  const store = useStore();
  const { data: catalog } = useCatalog();
  const subscribe = useCallback((fn: (r: ActivityResult) => void) => store.onActivity(fn), [store]);
  useActivityToasts(subscribe, catalog);
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
      <Account />
      <ImportBanner />
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
      <Toasts />
      <footer>
        <span className="note">
          {section === 'quiz'
            ? '1–4 відповідь, S або 0 пропуск, Enter далі.'
            : section === 'recall'
              ? 'Пробіл показати відповідь, 1–5 оцінка.'
              : ''}
        </span>
        <Link className="note" to="/import">
          Перенести прогрес зі старої версії
        </Link>
      </footer>
    </div>
  );
}
