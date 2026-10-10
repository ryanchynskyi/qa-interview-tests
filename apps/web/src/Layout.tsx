import { useCallback, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { currentStreak, levelFromXp, localDate, type ActivityResult } from '@qa-hub/shared';
import { useAuth } from './auth/AuthProvider';
import { useCatalog } from './hooks/content';
import { BookIcon, DashIcon, FlameIcon, QuizIcon, RecallIcon, UserIcon } from './lib/icons';
import { useNow } from './lib/stores';
import { Toasts, useActivityToasts } from './lib/toasts';
import { useProgress, useStore } from './progress/ProgressProvider';
import { ImportBanner } from './views/ImportBanner';

const VIEWS: { to: string; label: string; short: string; icon: ReactNode }[] = [
  { to: '/dash', label: 'Дашборд', short: 'Дашборд', icon: <DashIcon /> },
  { to: '/quiz', label: 'Тести', short: 'Тести', icon: <QuizIcon /> },
  { to: '/recall', label: 'Active Recall', short: 'Recall', icon: <RecallIcon /> },
  { to: '/kb', label: 'База знань', short: 'База', icon: <BookIcon /> },
];

function LevelChip() {
  const { stats } = useProgress();
  const lvl = levelFromXp(stats.totalXp);
  return (
    <Link to="/profile" className="lvlchip" data-testid="level" aria-label="Рівень і XP: профіль">
      <span className="row">
        <b>
          LVL {lvl.level} <span className="hide-sm">· {lvl.title}</span>
        </b>
        <span className="hide-sm">
          {lvl.xpIntoLevel}/{lvl.xpForNext} · усього {stats.totalXp}
        </span>
      </span>
      <span className="lvlbar" aria-hidden>
        <span style={{ width: `${lvl.progress * 100}%`, background: 'var(--accent)' }} />
      </span>
    </Link>
  );
}

function Streak() {
  const { stats, timeZone } = useProgress();
  const now = useNow();
  const streak = currentStreak(stats, localDate(now, timeZone));
  const hint =
    streak > 0
      ? `Найдовша серія: ${stats.longestStreak} дн.`
      : 'Серії поки немає: виконай завдання дня';
  return (
    <span className={`streak${streak > 0 ? ' on' : ''}`} title={hint} data-testid="streak">
      <FlameIcon />
      <span className="hide-sm">Серія: </span>
      {streak} дн.
    </span>
  );
}

function ProfileLink() {
  const { state } = useAuth();
  const name = state.status === 'user' ? state.user.displayName || state.user.email : '';
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <NavLink to="/profile" className="avatar" aria-label="Профіль" title="Профіль">
      {initials || <UserIcon />}
    </NavLink>
  );
}

function Account() {
  const { state, logout } = useAuth();
  const { pathname } = useLocation();
  if (state.status !== 'user') {
    if (pathname === '/login' || pathname === '/register') return null;
    return (
      <p className="acct">
        <span className="dot warn" aria-hidden />
        <span>
          Гостьовий режим: прогрес зберігається лише в цьому браузері.{' '}
          <Link to={`/login?next=${encodeURIComponent(pathname)}`}>Увійти</Link> або{' '}
          <Link to={`/register?next=${encodeURIComponent(pathname)}`}>створити акаунт</Link>, щоб
          зберігати прогрес на сервері.
        </span>
      </p>
    );
  }
  return (
    <p className="acct" data-testid="account">
      <span className="dot ok" aria-hidden />
      <span>
        Привіт, <Link to="/profile">{state.user.displayName}</Link> · прогрес зберігається в акаунті
        ({state.user.email}).{' '}
        <button type="button" className="linkbtn" onClick={() => void logout()}>
          Вийти
        </button>
      </span>
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
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/dash" className="logo" aria-label="QA Interview Hub: дашборд">
            qa-hub<span>$</span>_
          </Link>
          <nav className="views" aria-label="Розділи">
            {VIEWS.map((v) => (
              <NavLink key={v.to} to={v.to}>
                {v.icon}
                <span className="lbl">
                  <span className="long">{v.label}</span>
                  <span className="short">{v.short}</span>
                </span>
                {v.to === '/recall' && due > 0 && <span className="cnt">{due}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="me">
            <LevelChip />
            <Streak />
            <ProfileLink />
          </div>
        </div>
      </header>
      <div className="wrap">
        <Account />
        <ImportBanner />
        <main>
          <Outlet />
        </main>
        <footer>
          <span className="note keys">
            {section === 'quiz'
              ? '1–4 відповідь · S або 0 пропуск · Enter далі'
              : section === 'recall'
                ? 'Пробіл показати відповідь · 1–5 оцінка'
                : ''}
          </span>
          <span className="note">
            <Link to="/import">Перенести прогрес зі старої версії</Link> ·{' '}
            <a href={`${import.meta.env.BASE_URL}privacy.html`}>Конфіденційність</a>
          </span>
        </footer>
      </div>
      <Toasts />
    </>
  );
}
