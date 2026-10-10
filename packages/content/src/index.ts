import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundleSchema, type ContentBundle } from '@qa-hub/shared';

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
