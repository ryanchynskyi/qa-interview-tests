import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { HttpError } from '../api';
import { useAuth } from '../auth/AuthProvider';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Невірний email або пароль.',
  email_taken: 'Акаунт з таким email вже існує. Спробуй увійти.',
  rate_limited: 'Забагато спроб. Зачекай хвилину.',
};

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { state, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dash';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'user') return <Navigate to={next} replace />;

  const isLogin = mode === 'login';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isLogin) await login({ email, password });
      else await register({ email, password, displayName: displayName.trim() || undefined });
      navigate(next, { replace: true });
    } catch (err) {
      const code = err instanceof HttpError ? err.code : undefined;
      setError(
        (code && MESSAGES[code]) ??
          (err instanceof Error ? err.message : 'Щось пішло не так. Спробуй ще раз.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card authcard">
      <h2>{isLogin ? 'Вхід' : 'Реєстрація'}</h2>
      <p className="note" style={{ marginTop: 0 }}>
        {isLogin
          ? 'Увійди, щоб прогрес, рівень і щоденні завдання зберігалися в акаунті й були доступні на всіх пристроях.'
          : 'Акаунт зберігає прогрес на сервері: тести, Active Recall, XP, рівень і серію днів.'}
      </p>
      <form className="form" onSubmit={(e) => void submit(e)} noValidate={false}>
        {!isLogin && (
          <label>
            <span>Імʼя (необовʼязково)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={60}
            />
          </label>
        )}
        <label>
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          <span>Пароль{isLogin ? '' : ' (щонайменше 8 символів)'}</span>
          <input
            type="password"
            required
            minLength={isLogin ? 1 : 8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
        </label>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <div className="left">
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Зачекай…' : isLogin ? 'Увійти' : 'Створити акаунт'}
            </button>
          </div>
          <Link
            className="golink"
            to={`${isLogin ? '/register' : '/login'}?next=${encodeURIComponent(next)}`}
          >
            {isLogin ? 'Немає акаунта? Зареєструватися' : 'Вже є акаунт? Увійти'}
          </Link>
        </div>
      </form>
      <p className="note">
        Прогрес гостьового режиму поки що залишається в цьому браузері окремо від акаунта;
        перенесення додамо в наступному оновленні.
      </p>
    </div>
  );
}
