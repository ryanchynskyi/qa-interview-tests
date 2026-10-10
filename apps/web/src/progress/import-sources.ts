/**
 * Finds progress in this browser that could move into the current store: the guest
 * store (when signed in) and the legacy page's `qa-hub-v1` save (same origin only).
 */
import {
  fromGuest,
  fromLegacy,
  LEGACY_STORAGE_KEY,
  legacyIndexFromCatalog,
  payloadSize,
  type Catalog,
  type ImportPayload,
} from '@qa-hub/shared';
import { getMessages, type Messages } from '../i18n';
import type { ProgressState } from './types';

export interface ImportSource {
  kind: 'guest' | 'legacy';
  payload: ImportPayload;
  answers: number;
  cards: number;
}

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
};

/** "Don't offer again" flags are per destination: per account, or the guest store. */
const legacyDoneKey = (owner: string) => `qa-hub-legacy-imported:${owner}`;
const dismissedKey = (owner: string) => `qa-hub-import-dismissed:${owner}`;

export const markLegacyImported = (owner: string) =>
  write(legacyDoneKey(owner), String(Date.now()));
export const dismissImport = (owner: string) => write(dismissedKey(owner), String(Date.now()));
export const isImportDismissed = (owner: string) => read(dismissedKey(owner)) !== null;

const describe = (kind: ImportSource['kind'], payload: ImportPayload): ImportSource => ({
  kind,
  payload,
  answers: Object.keys(payload.questions).length,
  cards: Object.keys(payload.cards).length,
});

/** Parses pasted backup text from the legacy page ("Скопіювати прогрес"). */
export function parseLegacyBackup(
  text: string,
  catalog: Catalog,
  t: Messages = getMessages(),
): ImportPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error(t.importer.notJson);
  }
  try {
    return fromLegacy(raw, legacyIndexFromCatalog(catalog), Date.now());
  } catch {
    throw new Error(t.importer.noData);
  }
}

export function findImportSources(opts: {
  owner: string;
  signedIn: boolean;
  guest: ProgressState;
  catalog: Catalog;
}): ImportSource[] {
  const sources: ImportSource[] = [];
  if (opts.signedIn) {
    const p = fromGuest(opts.guest);
    if (payloadSize(p) > 0) sources.push(describe('guest', p));
  }
  const legacyText = read(LEGACY_STORAGE_KEY);
  if (legacyText && read(legacyDoneKey(opts.owner)) === null) {
    try {
      const p = parseLegacyBackup(legacyText, opts.catalog);
      if (payloadSize(p) > 0) sources.push(describe('legacy', p));
    } catch {
      // unreadable legacy save: ignore
    }
  }
  return sources;
}
