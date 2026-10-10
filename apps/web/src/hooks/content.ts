import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Catalog, CatalogChapter } from '@qa-hub/shared';
import { api } from '../api';

// Content only changes on deploy, so it never goes stale within a session.
const forever = { staleTime: Infinity, gcTime: Infinity } as const;

export const useCatalog = () =>
  useQuery({ queryKey: ['catalog'], queryFn: api.catalog, ...forever });

export const useSectionQuestions = (sectionId: string) =>
  useQuery({
    queryKey: ['questions', sectionId],
    queryFn: () => api.questions(sectionId),
    ...forever,
  });

export const useRecallCards = () =>
  useQuery({ queryKey: ['recall-cards'], queryFn: api.recallCards, ...forever });

export const useChapter = (id: string | undefined) =>
  useQuery({
    queryKey: ['chapter', id],
    queryFn: () => api.chapter(id!),
    enabled: !!id,
    ...forever,
  });

export const useKbSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });

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
