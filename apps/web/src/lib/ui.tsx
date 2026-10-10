import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { HttpError } from '../api';
import { getLang, useT, type Messages } from '../i18n';

/**
 * Readable error text in the current language: known API codes come from the messages,
 * other server text (Ukrainian) is shown as is in UA and replaced by a generic line in EN.
 */
export function errorText(e: unknown, t: Messages): string {
  if (e instanceof HttpError && e.code && t.auth.errors[e.code]) return t.auth.errors[e.code]!;
  const msg = e instanceof Error ? e.message : '';
  if (!msg) return t.common.somethingWrong;
  return getLang() === 'en' && /[\u0400-\u04FF]/.test(msg) ? t.common.somethingWrongRetry : msg;
}

/** Inline `code` spans, like the legacy fmt(): text is escaped by React. */
export function Fmt({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <code key={i}>{p}</code> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Legacy traffic-light colour for a 0..1 score. */
export const scoreColor = (v: number) =>
  v >= 0.75 ? 'var(--ok)' : v >= 0.45 ? 'var(--warn)' : 'var(--bad)';

export function shuffled<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Global shortcut handler that ignores typing in form fields and modified keys. */
export function useKeydown(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName))
        return;
      ref.current(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function Loading() {
  const t = useT();
  return (
    <div className="card">
      <p className="note" style={{ margin: 0 }}>
        {t.common.loading}
      </p>
    </div>
  );
}

export function LoadError({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useT();
  return (
    <div className="card" role="alert">
      <h2>{t.common.loadFailed}</h2>
      <p className="note">{error instanceof Error ? error.message : String(error)}</p>
      {retry && (
        <button type="button" className="btn" onClick={retry}>
          {t.common.retry}
        </button>
      )}
    </div>
  );
}
