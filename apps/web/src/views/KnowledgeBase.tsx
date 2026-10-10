import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import type { CatalogChapter } from '@qa-hub/shared';
import {
  useCatalog,
  useCatalogIndex,
  useChapter,
  useKbSearch,
  type CatalogIndex,
} from '../hooks/content';
import { createStore } from '../lib/stores';
import { LoadError, Loading } from '../lib/ui';
import { useProgress, useStore } from '../progress/ProgressProvider';

/**
 * The article's level, if it has one. Guides carry it; the "KB Middle" notes take it from
 * their source's name; theory and the Postman sheet have none.
 */
function articleLevel(a: { level?: string | null; kind: string }): string | null {
  const level = a.level ?? (a.kind === 'KB Middle' ? 'middle' : null);
  return level ? level[0]!.toUpperCase() + level.slice(1) : null;
}

/** Expanded article ids, kept while the tab stays open (legacy kbOpen). */
const openedStore = createStore<ReadonlySet<string>>(new Set());

export function KnowledgeBase() {
  const { topicId = '', chapterId = '', art = '' } = useParams();
  const { data: catalog, error, refetch } = useCatalog();
  const idx = useCatalogIndex(catalog);
  // The search box belongs to the current page: any navigation (a result, the sidebar)
  // clears it, like the legacy page re-rendering on every hash change.
  const { pathname } = useLocation();
  const [search, setSearch] = useState({ q: '', at: pathname });
  const query = search.at === pathname ? search.q : '';
  const debounced = useDebounced(query.trim(), 250);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!idx) return <Loading />;

  const topic = idx.topicName.has(topicId) ? topicId : '';
  if (topicId && !topic) return <Navigate to="/kb" replace />;
  const chapter = idx.chapter.get(chapterId);
  if (topic && !chapter) {
    const first = idx.chaptersByTopic.get(topic)?.[0];
    return first ? (
      <Navigate to={`/kb/${topic}/${first.id}`} replace />
    ) : (
      <Navigate to="/kb" replace />
    );
  }

  const searching = query.trim().length >= 2 && debounced.length >= 2;
  return (
    <div className="kb">
      <nav className="side" aria-label="Розділи бази знань">
        {idx.catalog.topics.map((t) => (
          <details key={t.id} open={chapter?.topicId === t.id}>
            <summary>{t.name}</summary>
            {(idx.chaptersByTopic.get(t.id) ?? []).map((ch) => (
              <Link
                key={ch.id}
                to={`/kb/${t.id}/${ch.id}`}
                aria-current={ch.id === chapter?.id ? 'page' : undefined}
              >
                {ch.title}
              </Link>
            ))}
          </details>
        ))}
      </nav>
      <div>
        <ChapterSelect idx={idx} current={chapter?.id ?? ''} />
        <div className="kbtop">
          <input
            type="search"
            placeholder="Пошук по всій базі знань"
            aria-label="Пошук"
            value={query}
            onChange={(e) => setSearch({ q: e.target.value, at: pathname })}
          />
        </div>
        {searching ? (
          <SearchResults idx={idx} q={debounced} />
        ) : chapter ? (
          <ChapterView key={chapter.id} idx={idx} chapter={chapter} art={art} />
        ) : (
          <Landing idx={idx} />
        )}
      </div>
    </div>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ChapterSelect({ idx, current }: { idx: CatalogIndex; current: string }) {
  const navigate = useNavigate();
  return (
    <select
      className="kbsel"
      aria-label="Розділ"
      value={current}
      onChange={(e) => {
        const ch = idx.chapter.get(e.target.value);
        if (ch) navigate(`/kb/${ch.topicId}/${ch.id}`);
      }}
    >
      {!current && <option value="">Оберіть розділ</option>}
      {idx.catalog.topics.map((t) => (
        <optgroup key={t.id} label={t.name}>
          {(idx.chaptersByTopic.get(t.id) ?? []).map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function Landing({ idx }: { idx: CatalogIndex }) {
  return (
    <div className="card">
      <h2>Knowledge Base</h2>
      <p style={{ marginTop: 0 }}>
        Теорія по всіх темах: гайди Cypress, Manual QA і SQL, конспект «Knowledge Base: Manual/Auto
        QA (Middle)», шпаргалка Postman і нові розділи з Playwright, TypeScript, System Design і
        патернів. Розділи відповідають темам тестів: з кожного питання є посилання сюди.
      </p>
      <div className="dgrid" style={{ margin: 0 }}>
        {idx.catalog.topics.map((t) => {
          const chs = idx.chaptersByTopic.get(t.id) ?? [];
          return (
            <Link
              key={t.id}
              className="sk"
              style={{ textDecoration: 'none', color: 'inherit' }}
              to={`/kb/${t.id}`}
            >
              <b>{t.name}</b>
              <span className="ln">
                {chs.length} розділів · {chs.reduce((n, c) => n + c.articleCount, 0)} статей
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SearchResults({ idx, q }: { idx: CatalogIndex; q: string }) {
  const { data: hits, error, isPending } = useKbSearch(q);
  if (error) return <LoadError error={error} />;
  if (isPending || !hits) return <Loading />;
  return (
    <div className="card res" data-testid="search-results">
      <h3>
        Знайдено: {hits.length}
        {hits.length === 40 ? '+' : ''}
      </h3>
      {hits.length ? (
        hits.map((h) => (
          <Link key={h.articleId} to={`/kb/${h.topicId}/${h.chapterId}/${h.index}`}>
            {h.title}
            <small>
              {idx.topicName.get(h.topicId)} · {h.chapterTitle}
            </small>
            <small>{h.snippet}</small>
          </Link>
        ))
      ) : (
        <p className="note">Нічого не знайдено. Спробуй інше слово або англійський термін.</p>
      )}
    </div>
  );
}

function ChapterView({
  idx,
  chapter,
  art,
}: {
  idx: CatalogIndex;
  chapter: CatalogChapter;
  art: string;
}) {
  const { data, error, refetch } = useChapter(chapter.id);
  const store = useStore();
  const progress = useProgress();
  const navigate = useNavigate();
  const opened = openedStore.use();

  const siblings = idx.chaptersByTopic.get(chapter.topicId) ?? [];
  const pos = siblings.findIndex((c) => c.id === chapter.id);
  const prev = siblings[pos - 1];
  const next = siblings[pos + 1];

  const quiz = useMemo(() => {
    const qs = idx.catalog.questions.filter((q) => q.chapterId === chapter.id);
    return {
      n: qs.length,
      y: qs.filter((q) => progress.questions[q.id]?.lastResult === 1).length,
      sectionId: qs[0]?.sectionId,
    };
  }, [idx, chapter.id, progress.questions]);
  const cards = idx.catalog.recallCards.filter((c) => c.chapterId === chapter.id).length;

  // Deep link to one article (#/kb/topic/chapter/3): open, highlight and scroll to it.
  useEffect(() => {
    if (!data) return;
    const target = art !== '' ? data.articles[+art] : undefined;
    if (target) {
      if (!openedStore.get().has(target.id)) {
        openedStore.set((prev) => new Set(prev).add(target.id));
        store.readArticle(target.id, chapter.id, chapter.topicId).catch(() => {});
      }
      setTimeout(
        () =>
          document
            .getElementById(`a${art}`)
            ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
        30,
      );
    } else window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, art]);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!data) return <Loading />;

  const allOpen = data.articles.every((a) => opened.has(a.id));
  /** Opening one article counts as reading it; "expand all" does not (no free XP). */
  const toggle = (id: string, open: boolean, countsAsRead = true) => {
    if (open === openedStore.get().has(id)) return;
    openedStore.set((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
    if (open && countsAsRead) store.readArticle(id, chapter.id, chapter.topicId).catch(() => {});
  };

  return (
    <div className="card" data-testid="chapter">
      <div className="meta">
        <span className="tag">{idx.topicName.get(chapter.topicId)}</span>
        <span>{data.articles.length} статей</span>
        {quiz.n > 0 && (
          <span>
            тести {quiz.y}/{quiz.n}
          </span>
        )}
      </div>
      <h2>{chapter.title}</h2>
      {chapter.subtitle && (
        <p className="note" style={{ marginTop: -6 }}>
          {chapter.subtitle}
        </p>
      )}
      <div className="actions" style={{ margin: '0 0 14px' }}>
        <div className="left">
          {quiz.sectionId && (
            <button
              type="button"
              className="btn sm"
              onClick={() => navigate(`/quiz/${quiz.sectionId}?ch=${chapter.id}`)}
            >
              Тести з розділу
            </button>
          )}
          {cards > 0 && (
            <Link className="btn sm" to={`/recall/ch/${chapter.id}`}>
              Recall ({cards})
            </Link>
          )}
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => data.articles.forEach((a) => toggle(a.id, !allOpen, false))}
          >
            {allOpen ? 'Згорнути всі' : 'Розгорнути всі'}
          </button>
        </div>
      </div>
      {data.articles.map((a, i) => (
        <details
          key={a.id}
          id={`a${i}`}
          className={`art${String(i) === art ? ' hit' : ''}`}
          open={opened.has(a.id)}
          onToggle={(e) => toggle(a.id, e.currentTarget.open)}
        >
          <summary>
            <span>{a.title}</span>
            {articleLevel(a) && <span className="st">{articleLevel(a)}</span>}
          </summary>
          {/* Article HTML is our own seeded content, not user input. */}
          <div className="body" dangerouslySetInnerHTML={{ __html: a.html }} />
        </details>
      ))}
      <div className="actions">
        {prev ? (
          <Link className="btn" to={`/kb/${chapter.topicId}/${prev.id}`}>
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="btn" to={`/kb/${chapter.topicId}/${next.id}`}>
            {next.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
