import { useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import type { ImportResult } from '@qa-hub/shared';
import { useAuth } from '../auth/AuthProvider';
import { useCatalog } from '../hooks/content';
import {
  dismissImport,
  findImportSources,
  isImportDismissed,
  markLegacyImported,
  type ImportSource,
} from '../progress/import-sources';
import { useGuestStore, useStore } from '../progress/ProgressProvider';

const LABEL: Record<ImportSource['kind'], string> = {
  guest: 'гостьовий режим',
  legacy: 'стара версія сайту',
};

export function summarize(r: ImportResult): string {
  const i = r.imported;
  const parts = [
    i.questions && `${i.questions} відповідей`,
    i.cards && `${i.cards} карток Recall`,
    i.articles && `${i.articles} прочитаних статей`,
    i.attempts && `${i.attempts} спроб`,
  ].filter(Boolean);
  if (!parts.length) return 'Нового нічого: усе це вже є.';
  return `Перенесено: ${parts.join(', ')}. +${r.xpGained} XP${
    r.levelUp ? `, новий рівень ${r.levelUp.to}!` : '.'
  }`;
}

const addResults = (a: ImportResult, b: ImportResult): ImportResult => ({
  imported: {
    questions: a.imported.questions + b.imported.questions,
    cards: a.imported.cards + b.imported.cards,
    articles: a.imported.articles + b.imported.articles,
    attempts: a.imported.attempts + b.imported.attempts,
  },
  skipped: a.skipped,
  xpGained: a.xpGained + b.xpGained,
  levelUp: b.levelUp ?? a.levelUp,
});

/**
 * Offers to move progress found in this browser into the current store. Keyed by
 * owner, so "later" for the guest doesn't hide the offer after signing in.
 */
export function ImportBanner() {
  const { state: auth } = useAuth();
  const owner = auth.status === 'user' ? auth.user.id : auth.status;
  return <Banner key={owner} />;
}

function Banner() {
  const { state: auth } = useAuth();
  const repo = useStore();
  const guest = useGuestStore();
  const guestState = useSyncExternalStore(guest.subscribe, guest.getSnapshot);
  const { data: catalog } = useCatalog();
  const signedIn = auth.status === 'user';
  const owner = signedIn ? auth.user.id : 'guest';
  const [hidden, setHidden] = useState(() => isImportDismissed(owner));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // localStorage flags change on import; `version` makes the memo read them again.
  const sources = useMemo(() => {
    if (!catalog || version < 0) return [];
    return findImportSources({ owner, signedIn, guest: guestState, catalog });
  }, [catalog, owner, signedIn, guestState, version]);

  if (done) {
    return (
      <div className="card importcard" role="status">
        <p style={{ margin: 0 }}>{done}</p>
        <button type="button" className="linkbtn" onClick={() => setDone(null)}>
          Закрити
        </button>
      </div>
    );
  }
  if (hidden || !sources.length || auth.status === 'loading') return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      let total: ImportResult | null = null;
      for (const s of sources) {
        const r = await repo.importProgress(s.payload);
        if (s.kind === 'guest') guest.clearAfterImport();
        else markLegacyImported(owner);
        total = total ? addResults(total, r) : r;
      }
      setDone(total ? summarize(total) : null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(`Не вдалося перенести: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card importcard" data-testid="import-banner">
      <p style={{ marginTop: 0 }}>
        <b>У цьому браузері є прогрес</b>:{' '}
        {sources
          .map((s) => `${LABEL[s.kind]} (${s.answers} відповідей, ${s.cards} карток)`)
          .join('; ')}
        . Перенести {signedIn ? 'в акаунт' : 'сюди'}? XP перерахується за правилами нового сайту;
        те, що вже є {signedIn ? 'в акаунті' : 'тут'}, не зміниться.
      </p>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="actions" style={{ marginTop: 0 }}>
        <div className="left">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Переношу…' : 'Перенести'}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setHidden(true)}>
            Пізніше
          </button>
        </div>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            dismissImport(owner);
            setHidden(true);
          }}
        >
          Не пропонувати
        </button>
      </div>
      <p className="note" style={{ marginBottom: 0 }}>
        Прогрес з іншого браузера можна перенести через <Link to="/import">резервну копію</Link>.
      </p>
    </div>
  );
}
