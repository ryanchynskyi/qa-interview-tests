import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contentBundleSchema,
  contentTranslationSchema,
  type ContentBundle,
  type ContentLang,
  type ContentTranslation,
} from '@qa-hub/shared';

export const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../data');

const read = (name: string): unknown => JSON.parse(readFileSync(resolve(dataDir, name), 'utf8'));

/** Loads and validates the extracted content. Throws if any file is malformed. */
export function loadContent(): ContentBundle {
  return contentBundleSchema.parse({
    topics: read('topics.json'),
    sections: read('sections.json'),
    chapters: read('chapters.json'),
    articles: read('articles.json'),
    questions: read('questions.json'),
    recallCards: read('recall-cards.json'),
  });
}

/** Files of a translation overlay in `data/<lang>/`, one per content kind. */
export const TRANSLATION_FILES = {
  topics: 'topics.json',
  sections: 'sections.json',
  chapters: 'chapters.json',
  groups: 'groups.json',
  questions: 'questions.json',
  recallCards: 'recall-cards.json',
  articles: 'articles.json',
} as const satisfies Record<keyof ContentTranslation, string>;

/**
 * Loads the overlay for a language. A missing file means "not translated yet" and falls
 * back to Ukrainian; a malformed one throws.
 */
export function loadTranslation(lang: Exclude<ContentLang, 'uk'>): ContentTranslation {
  const raw: Record<string, unknown> = {};
  for (const [kind, file] of Object.entries(TRANSLATION_FILES)) {
    const path = resolve(dataDir, lang, file);
    if (existsSync(path)) raw[kind] = JSON.parse(readFileSync(path, 'utf8'));
  }
  return contentTranslationSchema.parse(raw);
}
