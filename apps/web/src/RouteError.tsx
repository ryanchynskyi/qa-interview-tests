import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { useT } from './i18n';

const RELOAD_KEY = 'qa-hub-chunk-reload-at';

/**
 * A lazy view's file failed to load. Usually a deploy replaced the hashed chunks while
 * this tab still ran the old build (Safari: "Importing a module script failed").
 */
export function isChunkLoadError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i.test(
    msg,
  );
}

/** Reloads once to pick up the new build; false if it already tried a moment ago. */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // No storage (private mode): still reload, the browser keeps us from looping fast.
  }
  window.location.reload();
  return true;
}

/** Route error screen in the app's style, instead of React Router's developer page. */
export function RouteError() {
  const error = useRouteError();
  const t = useT();
  const chunk = isChunkLoadError(error);

  useEffect(() => {
    if (chunk) reloadForNewBuild();
  }, [chunk]);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <div className="card errpage" role="alert">
      <p className="prompt">$ qa-hub run</p>
      <h1>{chunk ? t.error.newVersionTitle : t.error.title}</h1>
      <p className="note">{chunk ? t.error.newVersionText : t.error.text}</p>
      <pre className="errline">
        <span className="bad">✗ FAIL</span> {detail}
      </pre>
      <div className="actions">
        <div className="left">
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            {t.error.reload}
          </button>
          <Link className="btn" to="/dash" reloadDocument>
            {t.error.toDashboard}
          </Link>
        </div>
      </div>
    </div>
  );
}
