import { useCallback, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { currentStreak, levelFromXp, localDate, type ActivityResult } from '@qa-hub/shared';
import { useAuth } from './auth/AuthProvider';
import { useCatalog } from './hooks/content';
import { LANGS, setLang, useLang, useT, type Messages } from './i18n';
import {
  BookIcon,
  DashIcon,
  FlameIcon,
  HelpIcon,
  LogoutIcon,
  QuizIcon,
  RecallIcon,
  UserIcon,
} from './lib/icons';
import { useNow } from './lib/stores';
import { Toasts, useActivityToasts } from './lib/toasts';
import { useProgress, useStore } from './progress/ProgressProvider';
import { ImportBanner } from './views/ImportBanner';

const views = (t: Messages): { to: string; label: string; short: string; icon: ReactNode }[] => [
  { to: '/dash', label: t.nav.dash, short: t.nav.dash, icon: <DashIcon /> },
  { to: '/quiz', label: t.nav.quiz, short: t.nav.quiz, icon: <QuizIcon /> },
  { to: '/recall', label: t.nav.recall, short: t.nav.recallShort, icon: <RecallIcon /> },
  { to: '/kb', label: t.nav.kb, short: t.nav.kbShort, icon: <BookIcon /> },
];

/** UA / EN switch; the choice is kept in localStorage. */
export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  return (
    <div className={`langsw ${className}`} role="group" aria-label={t.nav.language}>
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} lang={l} onClick={() => setLang(l)}>
          {l === 'uk' ? 'UA' : 'EN'}
        </button>
      ))}
    </div>
  );
}

function LevelChip() {
  const { stats } = useProgress();
  const t = useT();
  const lvl = levelFromXp(stats.totalXp);
  return (
    <Link to="/profile" className="lvlchip" data-testid="level" aria-label={t.nav.levelLabel}>
      <span className="row">
        <b>
          LVL {lvl.level} <span className="hide-sm">· {lvl.title}</span>
        </b>
        <span className="hide-sm">
          {lvl.xpIntoLevel}/{lvl.xpForNext} · {t.nav.total} {stats.totalXp}
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
  const t = useT();
  const now = useNow();
  const streak = currentStreak(stats, localDate(now, timeZone));
  const hint = streak > 0 ? t.nav.streakLongest(stats.longestStreak) : t.nav.streakNone;
  return (
    <span className={`streak${streak > 0 ? ' on' : ''}`} title={hint} data-testid="streak">
      <FlameIcon />
      <span className="hide-sm">{t.nav.streak}</span>
      {streak} {t.nav.days}
    </span>
  );
}

function ProfileLink() {
  const { state } = useAuth();
  const t = useT();
  const name = state.status === 'user' ? state.user.displayName || state.user.email : '';
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <NavLink to="/profile" className="avatar" aria-label={t.nav.profile} title={t.nav.profile}>
      {initials || <UserIcon />}
    </NavLink>
  );
}

function LogoutButton() {
  const { state, logout } = useAuth();
  const t = useT();
  if (state.status !== 'user') return null;
  return (
    <button
      type="button"
      className="iconbtn"
      aria-label={t.nav.signOut}
      title={t.nav.signOutTitle}
      onClick={() => void logout()}
    >
      <LogoutIcon />
    </button>
  );
}

function Account() {
  const { state } = useAuth();
  const t = useT();
  const { pathname } = useLocation();
  if (state.status !== 'user') {
    if (pathname === '/login' || pathname === '/register') return null;
    return (
      <p className="acct">
        <span className="dot warn" aria-hidden />
        <span>
          {t.account.guest(
            <Link to={`/login?next=${encodeURIComponent(pathname)}`}>{t.account.login}</Link>,
            <Link to={`/register?next=${encodeURIComponent(pathname)}`}>{t.account.register}</Link>,
          )}
        </span>
      </p>
    );
  }
  return (
    <p className="acct" data-testid="account">
      <span className="dot ok" aria-hidden />
      <span>
        {t.account.signedIn(<Link to="/profile">{state.user.displayName}</Link>, state.user.email)}
      </span>
    </p>
  );
}

export function Layout() {
  const progress = useProgress();
  const store = useStore();
  const t = useT();
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
          <Link to="/dash" className="logo" aria-label={t.nav.homeLabel}>
            qa<span className="full">-hub</span>
            <span className="dollar">$</span>_
          </Link>
          <nav className="views" aria-label={t.nav.sections}>
            {views(t).map((v) => (
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
            <LangSwitch className="hide-sm" />
            <NavLink
              to="/tutorial"
              className="tutbtn"
              aria-label={t.nav.tutorial}
              title={t.nav.tutorialTitle}
            >
              <HelpIcon />
              <span className="lbl">{t.nav.tutorial}</span>
            </NavLink>
            <ProfileLink />
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="wrap">
        <Account />
        <ImportBanner />
        <main>
          <Outlet />
        </main>
      </div>
      <Footer section={section} />
      <Toasts />
    </>
  );
}

const BASE = import.meta.env.BASE_URL;

function Footer({ section }: { section: string }) {
  const t = useT();
  const keys =
    section === 'quiz' ? t.footer.keysQuiz : section === 'recall' ? t.footer.keysRecall : null;
  return (
    <footer className="site-footer">
      <div className="footer-in">
        <div className="footer-brand">
          <Link to="/dash" className="logo">
            qa-hub<span className="dollar">$</span>_
          </Link>
          <p className="note">{t.footer.tagline}</p>
          {keys && (
            <p className="keys">
              <span className="kbd">{t.footer.keys}</span> {keys}
            </p>
          )}
          <LangSwitch />
        </div>
        <nav className="footer-col" aria-label={t.footer.learn}>
          <h3>{t.footer.learn}</h3>
          <Link to="/dash">{t.nav.dash}</Link>
          <Link to="/quiz">{t.nav.quiz}</Link>
          <Link to="/recall">{t.nav.recall}</Link>
          <Link to="/kb">{t.nav.kb}</Link>
          <Link to="/tutorial">{t.nav.tutorial}</Link>
        </nav>
        <nav className="footer-col" aria-label={t.footer.account}>
          <h3>{t.footer.account}</h3>
          <Link to="/profile">{t.nav.profile}</Link>
          <Link to="/import">{t.footer.importProgress}</Link>
          <a href={BASE + 'legacy/'}>{t.footer.legacy}</a>
          <a href={BASE + 'privacy.html'}>{t.footer.privacy}</a>
        </nav>
      </div>
    </footer>
  );
}
