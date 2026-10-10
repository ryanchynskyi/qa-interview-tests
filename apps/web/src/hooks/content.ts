import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Catalog, CatalogChapter } from '@qa-hub/shared';
import { api } from '../api';
import { useLang } from '../i18n';

// Content only changes on deploy, so it never goes stale within a session. Every query is
// keyed by language: switching it fetches the other overlay once.
const forever = { staleTime: Infinity, gcTime: Infinity } as const;

export const useCatalog = () => {
  const lang = useLang();
  return useQuery({ queryKey: ['catalog', lang], queryFn: () => api.catalog(lang), ...forever });
};

export const useSectionQuestions = (sectionId: string) => {
  const lang = useLang();
  return useQuery({
    queryKey: ['questions', sectionId, lang],
    queryFn: () => api.questions(sectionId, lang),
    ...forever,
  });
};

export const useRecallCards = () => {
  const lang = useLang();
  return useQuery({
    queryKey: ['recall-cards', lang],
    queryFn: () => api.recallCards(lang),
    ...forever,
  });
};

export const useChapter = (id: string | undefined) => {
  const lang = useLang();
  return useQuery({
    queryKey: ['chapter', id, lang],
    queryFn: () => api.chapter(id!, lang),
    enabled: !!id,
    ...forever,
  });
};

export const useKbSearch = (q: string) => {
  const lang = useLang();
  return useQuery({
    queryKey: ['search', q, lang],
    queryFn: () => api.search(q, lang),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
};

/** Lookup tables derived from the catalog, built once per catalog. */
export interface CatalogIndex {
  catalog: Catalog;
  topicName: Map<string, string>;
  chapter: Map<string, CatalogChapter>;
  chaptersByTopic: Map<string, CatalogChapter[]>;
  topicOfSection: Map<string, string>;
  /** Topic → its section ids, in order. */
  sectionsByTopic: Map<string, string[]>;
}

export function useCatalogIndex(catalog: Catalog | undefined): CatalogIndex | undefined {
  return useMemo(() => {
    if (!catalog) return undefined;
    const chaptersByTopic = new Map<string, CatalogChapter[]>();
    for (const ch of catalog.chapters) {
      const list = chaptersByTopic.get(ch.topicId) ?? [];
      list.push(ch);
      chaptersByTopic.set(ch.topicId, list);
    }
    const sectionsByTopic = new Map<string, string[]>();
    for (const s of catalog.sections) {
      sectionsByTopic.set(s.topicId, [...(sectionsByTopic.get(s.topicId) ?? []), s.id]);
    }
    return {
      catalog,
      topicName: new Map(catalog.topics.map((t) => [t.id, t.name])),
      chapter: new Map(catalog.chapters.map((ch) => [ch.id, ch])),
      chaptersByTopic,
      topicOfSection: new Map(catalog.sections.map((s) => [s.id, s.topicId])),
      sectionsByTopic,
    };
  }, [catalog]);
}
