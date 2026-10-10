import { createStore } from '../lib/stores';
import { en } from './en';
import { uk, type Messages } from './uk';

export type { Messages };
export type Lang = 'uk' | 'en';
export const LANGS: readonly Lang[] = ['uk', 'en'];

const KEY = 'qa-hub-lang';
const MESSAGES: Record<Lang, Messages> = { uk, en };
/** BCP 47 tags for Intl (dates, numbers, plural rules). */
export const LOCALE: Record<Lang, string> = { uk: 'uk-UA', en: 'en-GB' };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'uk' || saved === 'en') return saved;
  } catch {
    // No storage (private mode, tests): fall through to the default.
  }
  // Ukrainian stays the default; English is an explicit choice.
  return 'uk';
}

const langStore = createStore<Lang>(initialLang());

function applyToDocument(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
applyToDocument(langStore.get());

/** The current language, outside React (API requests, toasts). */
export const getLang = (): Lang => langStore.get();
/** Messages of the current language, outside React. */
export const getMessages = (): Messages => MESSAGES[langStore.get()];

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Keeps working for this page even without storage.
  }
  applyToDocument(lang);
  langStore.set(lang);
}

export const useLang = (): Lang => langStore.use();
export const useT = (): Messages => MESSAGES[langStore.use()];

/** Picks the plural form for `n` (Ukrainian has one/few/many, English one/other). */
export function plural(
  lang: Lang,
  n: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
): string {
  return forms[new Intl.PluralRules(LOCALE[lang]).select(n)] ?? forms.other;
}
