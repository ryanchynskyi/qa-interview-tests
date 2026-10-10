import { useState } from 'react';
import { Link } from 'react-router';
import { payloadSize, type ImportPayload } from '@qa-hub/shared';
import { useAuth } from '../auth/AuthProvider';
import { useCatalog } from '../hooks/content';
import { LoadError, Loading } from '../lib/ui';
import { parseLegacyBackup } from '../progress/import-sources';
import { useStore } from '../progress/ProgressProvider';
import { summarize } from './ImportBanner';

/** Paste a backup from the old site ("Скопіювати прогрес") and move it in. */
export function ImportPage() {
  const { data: catalog, error: catErr } = useCatalog();
  const { state: auth } = useAuth();
  const repo = useStore();
  const [text, setText] = useState('');
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (catErr) return <LoadError error={catErr} />;
  if (!catalog) return <Loading />;

  const check = () => {
    setMessage(null);
    try {
      const p = parseLegacyBackup(text, catalog);
      if (!payloadSize(p)) throw new Error('Копія порожня: у ній немає відповідей чи оцінок.');
      setPayload(p);
      setError(null);
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      setMessage(summarize(await repo.importProgress(payload)));
      setPayload(null);
      setText('');
    } catch (e) {
      setError(`Не вдалося перенести: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const count = (o: object) => Object.keys(o).length;
  return (
    <div className="card backup" style={{ maxWidth: 760 }}>
      <h2>Перенести прогрес зі старої версії</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Відкрий стару версію сайту в браузері, де є твій прогрес, натисни «Скопіювати прогрес» і
        встав текст сюди. Прогрес піде{' '}
        {auth.status === 'user' ? `в акаунт ${auth.user.email}` : 'в цей браузер (гостьовий режим)'}
        . Те, що вже є, не зміниться; XP перерахується за правилами нового сайту.
      </p>
      <textarea
        aria-label="Скопійований прогрес"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPayload(null);
        }}
        placeholder='{"ver":3,"q":{...},"rc":{...}}'
      />
      {payload && (
        <p data-testid="import-preview">
          У копії: {count(payload.questions)} відповідей, {count(payload.cards)} карток Recall,{' '}
          {Object.values(payload.attempts).reduce((n, a) => n + a.length, 0)} спроб тестів.
        </p>
      )}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="actions">
        <div className="left">
          {payload ? (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void run()}
            >
              {busy ? 'Переношу…' : 'Перенести'}
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={!text.trim()} onClick={check}>
              Перевірити
            </button>
          )}
        </div>
        <Link className="golink" to="/dash">
          До дашборду →
        </Link>
      </div>
    </div>
  );
}
