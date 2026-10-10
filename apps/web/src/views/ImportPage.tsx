import { useState } from 'react';
import { Link } from 'react-router';
import { payloadSize, type ImportPayload } from '@qa-hub/shared';
import { useAuth } from '../auth/AuthProvider';
import { useCatalog } from '../hooks/content';
import { useT } from '../i18n';
import { LoadError, Loading } from '../lib/ui';
import { parseLegacyBackup } from '../progress/import-sources';
import { useStore } from '../progress/ProgressProvider';
import { summarize } from './ImportBanner';

/** Paste a backup from the old site ("Скопіювати прогрес") and move it in. */
export function ImportPage() {
  const { data: catalog, error: catErr } = useCatalog();
  const { state: auth } = useAuth();
  const repo = useStore();
  const t = useT();
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
      const p = parseLegacyBackup(text, catalog, t);
      if (!payloadSize(p)) throw new Error(t.importer.emptyCopy);
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
      setMessage(summarize(await repo.importProgress(payload), t));
      setPayload(null);
      setText('');
    } catch (e) {
      setError(t.importer.failed(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const count = (o: object) => Object.keys(o).length;
  return (
    <div className="card backup" style={{ maxWidth: 760 }}>
      <h2>{t.importer.pageTitle}</h2>
      <p className="note" style={{ marginTop: 0 }}>
        {t.importer.pageLead(
          auth.status === 'user' ? t.importer.toAccount(auth.user.email) : t.importer.toBrowser,
        )}
      </p>
      <textarea
        aria-label={t.importer.pasted}
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
          {t.importer.inCopy(
            count(payload.questions),
            count(payload.cards),
            Object.values(payload.attempts).reduce((n, a) => n + a.length, 0),
          )}
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
              {busy ? t.importer.moving : t.importer.move}
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={!text.trim()} onClick={check}>
              {t.importer.check}
            </button>
          )}
        </div>
        <Link className="golink" to="/dash">
          {t.common.toDashboardArrow}
        </Link>
      </div>
    </div>
  );
}
