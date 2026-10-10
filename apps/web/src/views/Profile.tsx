import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  currentStreak,
  isValidTimeZone,
  levelFromXp,
  localDate,
  type AccountInfo,
  type XpDay,
} from '@qa-hub/shared';
import { api, HttpError } from '../api';
import { useAuth } from '../auth/AuthProvider';
import { useNow } from '../lib/stores';
import { useT } from '../i18n';
import { errorText, LoadError, Loading } from '../lib/ui';
import { useProgress, useStore } from '../progress/ProgressProvider';
import { ServerStore } from '../progress/server-store';
import { XpChart } from './XpChart';

const DAYS = 30;

/** Guests: XP per local day from the local XP log (last 100 events). */
function guestDays(log: { amount: number; at: number }[], tz: string, now: number): XpDay[] {
  const today = localDate(now, tz);
  const first = addDays(today, -(DAYS - 1));
  const by = new Map<string, number>();
  for (const g of log) {
    const d = localDate(g.at, tz);
    if (d >= first) by.set(d, (by.get(d) ?? 0) + g.amount);
  }
  return Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(first, i);
    return { date, xp: by.get(date) ?? 0 };
  });
}

export function Profile() {
  const { state } = useAuth();
  const progress = useProgress();
  const t = useT();
  const now = useNow();
  const lvl = levelFromXp(progress.stats.totalXp);
  const streak = currentStreak(progress.stats, localDate(now, progress.timeZone));
  const signedIn = state.status === 'user';

  const history = useQuery({
    queryKey: [
      'xp-history',
      state.status === 'user' ? state.user.id : 'guest',
      progress.stats.totalXp,
    ],
    queryFn: () => api.xpHistory(DAYS),
    enabled: signedIn,
  });
  const localDaysData = useMemo(
    () => guestDays(progress.xpLog, progress.timeZone, now),
    [progress.xpLog, progress.timeZone, now],
  );
  const days = signedIn ? history.data : localDaysData;

  return (
    <>
      <section className="card" style={{ marginBottom: 14 }}>
        <h2>{signedIn ? state.user.displayName : t.profile.guest}</h2>
        <div className="stats">
          <div>
            <b>{lvl.level}</b>
            <span>
              {t.profile.level} · {lvl.title}
            </span>
          </div>
          <div>
            <b>{progress.stats.totalXp}</b>
            <span>{t.profile.xpTotal}</span>
          </div>
          <div>
            <b>{streak}</b>
            <span>{t.profile.streakNow}</span>
          </div>
          <div>
            <b>{progress.stats.longestStreak}</b>
            <span>{t.profile.streakBest}</span>
          </div>
        </div>
        {days ? (
          <XpChart days={days} />
        ) : history.error ? (
          <LoadError error={history.error} />
        ) : (
          <Loading />
        )}
        {!signedIn && (
          <p className="note">
            {t.profile.guestChart(
              <Link to="/register?next=%2Fprofile">{t.profile.createAccount}</Link>,
            )}
          </p>
        )}
      </section>
      {signedIn && <AccountSettings />}
    </>
  );
}

function AccountSettings() {
  const account = useQuery({ queryKey: ['account'], queryFn: api.account });
  if (account.error)
    return <LoadError error={account.error} retry={() => void account.refetch()} />;
  if (!account.data) return <Loading />;
  return (
    <div className="profile-grid">
      <NameAndZone info={account.data} />
      <Password info={account.data} />
      <SignInMethods info={account.data} />
      <DeleteAccount info={account.data} />
    </div>
  );
}

function NameAndZone({ info }: { info: AccountInfo }) {
  const { updateUser } = useAuth();
  const store = useStore();
  const t = useT();
  const qc = useQueryClient();
  const [name, setName] = useState(info.displayName);
  const [zone, setZone] = useState(info.timeZone);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const zones = useMemo(() => {
    const listed =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    // Some browsers still list the old "Europe/Kiev"; offer the current name when it works.
    const all = isValidTimeZone('Europe/Kyiv')
      ? listed.map((z) => (z === 'Europe/Kiev' ? 'Europe/Kyiv' : z))
      : listed;
    return all.includes(info.timeZone) ? all : [info.timeZone, ...all];
  }, [info.timeZone]);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const user = await api.updateMe({
        displayName: name.trim() || undefined,
        timeZone: zone !== info.timeZone ? zone : undefined,
      });
      updateUser(user);
      if (zone !== info.timeZone && store instanceof ServerStore) await store.load();
      await qc.invalidateQueries({ queryKey: ['account'] });
      setMsg({ ok: true, text: t.common.saved });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, t) });
    }
  };

  return (
    <section className="card">
      <h3>{t.profile.nameAndZone}</h3>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label>
          <span>{t.profile.name}</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>{t.profile.zone}</span>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            disabled={!!info.timeZoneLockedUntil}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        {info.timeZoneLockedUntil ? (
          <p className="note" style={{ margin: 0 }}>
            {t.profile.zoneCooldown}{' '}
            {new Date(info.timeZoneLockedUntil).toLocaleString(t.locale, {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
            .
          </p>
        ) : (
          zone !== browserZone && (
            <button type="button" className="linkbtn" onClick={() => setZone(browserZone)}>
              {t.profile.zoneFromDevice(browserZone)}
            </button>
          )
        )}
        {msg && <p className={msg.ok ? 'ok-msg' : 'err'}>{msg.text}</p>}
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="submit" className="btn primary">
            {t.common.save}
          </button>
        </div>
      </form>
    </section>
  );
}

function Password({ info }: { info: AccountInfo }) {
  const qc = useQueryClient();
  const t = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.changePassword({
        currentPassword: info.hasPassword ? current : undefined,
        newPassword: next,
      });
      setCurrent('');
      setNext('');
      await qc.invalidateQueries({ queryKey: ['account'] });
      setMsg({ ok: true, text: t.profile.passwordSaved });
    } catch (err) {
      const code = err instanceof HttpError ? err.code : undefined;
      setMsg({
        ok: false,
        text: code === 'invalid_credentials' ? t.profile.wrongPassword : errorText(err, t),
      });
    }
  };

  return (
    <section className="card">
      <h3>{info.hasPassword ? t.profile.changePassword : t.profile.addPassword}</h3>
      {!info.hasPassword && (
        <p className="note" style={{ marginTop: 0 }}>
          {t.profile.viaGoogle}
        </p>
      )}
      <form className="form" onSubmit={(e) => void submit(e)}>
        {info.hasPassword && (
          <label>
            <span>{t.profile.currentPassword}</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
        )}
        <label>
          <span>{t.profile.newPassword}</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        {msg && <p className={msg.ok ? 'ok-msg' : 'err'}>{msg.text}</p>}
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="submit" className="btn primary">
            {t.profile.savePassword}
          </button>
        </div>
      </form>
    </section>
  );
}

function SignInMethods({ info }: { info: AccountInfo }) {
  const t = useT();
  const google = info.providers.includes('google');
  return (
    <section className="card">
      <h3>{t.profile.methods}</h3>
      <div className="tw" style={{ margin: 0 }}>
        <table>
          <tbody>
            <tr>
              <td>{t.profile.emailPassword}</td>
              <td>{info.hasPassword ? t.profile.on : t.profile.noPassword}</td>
            </tr>
            <tr>
              <td>Google</td>
              <td>{google ? t.profile.connected : t.profile.notConnected}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!google && <p className="note">{t.profile.linkGoogle(info.email)}</p>}
      <p className="note" style={{ marginBottom: 0 }}>
        {t.profile.created}{' '}
        {new Date(info.createdAt).toLocaleDateString(t.locale, { dateStyle: 'long' })}.
      </p>
    </section>
  );
}

function DeleteAccount({ info }: { info: AccountInfo }) {
  const { forget } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === info.email;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(typed);
      forget();
      navigate('/dash', { replace: true });
    } catch (err) {
      setError(errorText(err, t));
      setBusy(false);
    }
  };

  return (
    <section className="card danger">
      <h3>{t.profile.deleteTitle}</h3>
      <p className="note" style={{ marginTop: 0 }}>
        {t.profile.deleteText}
      </p>
      <div className="form">
        <label>
          <span>{info.email}</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            aria-label={t.profile.deleteConfirmLabel}
          />
        </label>
        {error && <p className="err">{error}</p>}
        <div className="actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn"
            style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
            disabled={!matches || busy}
            onClick={() => void remove()}
          >
            {busy ? t.profile.deleting : t.profile.deleteForever}
          </button>
        </div>
      </div>
    </section>
  );
}
