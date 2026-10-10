import { useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import type { ImportResult } from '@qa-hub/shared';
import { useAuth } from '../auth/AuthProvider';
import { useCatalog } from '../hooks/content';
import { useT, type Messages } from '../i18n';
import {
  dismissImport,
  findImportSources,
  isImportDismissed,
  markLegacyImported,
} from '../progress/import-sources';
import { useGuestStore, useStore } from '../progress/ProgressProvider';

export function summarize(r: ImportResult, t: Messages): string {
  const i = r.imported;
  const m = t.importer;
  const parts = [
    i.questions && m.answers(i.questions),
    i.cards && m.cards(i.cards),
    i.articles && m.articles(i.articles),
    i.attempts && m.attempts(i.attempts),
  ].filter(Boolean);
  if (!parts.length) return m.nothingNew;
  return m.done(parts.join(', '), r.xpGained, r.levelUp?.to ?? null);
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
  const t = useT();
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
          {t.common.close}
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
      setDone(total ? summarize(total, t) : null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(t.importer.failed(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card importcard" data-testid="import-banner">
      <p style={{ marginTop: 0 }}>
        <b>{t.importer.bannerTitle}</b>:{' '}
        {sources
          .map((s) => t.importer.bannerSource(t.importer.source[s.kind], s.answers, s.cards))
          .join('; ')}
        {t.importer.bannerAsk(signedIn)}
      </p>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="actions" style={{ marginTop: 0 }}>
        <div className="left">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
            {busy ? t.importer.moving : t.importer.move}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setHidden(true)}>
            {t.importer.later}
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
          {t.importer.never}
        </button>
      </div>
      <p className="note" style={{ marginBottom: 0 }}>
        {t.importer.otherBrowser(<Link to="/import">{t.importer.backup}</Link>)}
      </p>
    </div>
  );
}
