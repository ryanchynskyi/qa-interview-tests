import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RECALL_INTERVAL_DAYS, topicSkills, type RecallCardDto } from '@qa-hub/shared';
import { useCatalog, useCatalogIndex, useRecallCards, type CatalogIndex } from '../hooks/content';
import { createStore, useNow } from '../lib/stores';
import { Chip, Fmt, LoadError, Loading, shuffled, useKeydown } from '../lib/ui';
import { useProgress, useSkillProgress, useStore } from '../progress/ProgressProvider';

const RATES: [number, string][] = [
  [1, 'Не знаю'],
  [2, 'Слабко'],
  [3, 'Частково'],
  [4, 'Добре'],
  [5, 'Як на співбесіді'],
];

interface Filter {
  topic: string;
  chapter: string;
  due: boolean;
}
interface Session {
  items: RecallCardDto[];
  i: number;
  shown: boolean;
  got: { card: RecallCardDto; rating: number }[];
  requeued: string[];
  xp: number;
  /** A rating is being saved; further input waits. */
  pending: boolean;
  error: string | null;
}

// Survives switching tabs, like the legacy page.
const sessionStore = createStore<Session | null>(null);
const countStore = createStore<10 | 20 | 0>(10);

export function Recall() {
  const { a = '', b = '' } = useParams();
  const { data: catalog, error: catErr } = useCatalog();
  const idx = useCatalogIndex(catalog);
  const { data: cards, error, refetch } = useRecallCards();
  const stored = sessionStore.use();
  const navigate = useNavigate();

  if (error || catErr) return <LoadError error={error ?? catErr} retry={() => void refetch()} />;
  if (!idx || !cards) return <Loading />;

  const filter: Filter = {
    chapter: a === 'ch' && idx.chapter.has(b) ? b : '',
    due: a === 'due',
    topic: idx.topicName.has(a) ? a : '',
  };

  // A session stopped before any rating has nothing to summarise.
  const active = stored && (stored.i < stored.items.length || stored.got.length) ? stored : null;
  // Plain /recall resumes an unfinished session.
  if (active && !a) {
    return <SessionView idx={idx} session={active} onEnd={() => sessionStore.set(null)} />;
  }

  return (
    <SetupView
      idx={idx}
      cards={cards}
      filter={filter}
      onStart={(items) => {
        sessionStore.set({
          items,
          i: 0,
          shown: false,
          got: [],
          requeued: [],
          xp: 0,
          pending: false,
          error: null,
        });
        // The session lives at plain #/recall, so the tab link resumes it.
        navigate('/recall');
      }}
    />
  );
}

function SetupView({
  idx,
  cards,
  filter,
  onStart,
}: {
  idx: CatalogIndex;
  cards: RecallCardDto[];
  filter: Filter;
  onStart: (items: RecallCardDto[]) => void;
}) {
  const navigate = useNavigate();
  const progress = useProgress();
  const skill = useSkillProgress();
  const count = countStore.use();
  const now = useNow();

  const { chapter, topic, due: dueOnly } = filter;
  const cardProgress = progress.cards;
  const pool = useMemo(() => {
    let scope = cards;
    if (chapter) scope = scope.filter((c) => c.chapterId === chapter);
    else if (topic) scope = scope.filter((c) => c.topicId === topic);
    const due: RecallCardDto[] = [];
    const fresh: RecallCardDto[] = [];
    const later: RecallCardDto[] = [];
    for (const c of scope) {
      const p = cardProgress[c.id];
      if (!p) fresh.push(c);
      else if (p.dueAt <= now) due.push(c);
      else later.push(c);
    }
    due.sort((x, y) => cardProgress[x.id]!.rating - cardProgress[y.id]!.rating);
    later.sort((x, y) => cardProgress[x.id]!.dueAt - cardProgress[y.id]!.dueAt);
    return dueOnly ? { due, fresh: [], later: [] } : { due, fresh: shuffled(fresh), later };
  }, [cards, chapter, topic, dueOnly, cardProgress, now]);

  const rows = useMemo(() => topicSkills(idx.catalog, skill, now), [idx, skill, now]);
  const total = pool.due.length + pool.fresh.length + pool.later.length;
  const scope = filter.chapter
    ? `Розділ: ${idx.chapter.get(filter.chapter)?.title}`
    : filter.due
      ? 'Картки, які пора повторити'
      : filter.topic
        ? idx.topicName.get(filter.topic)
        : 'Усі теми';

  return (
    <div className="two">
      <section className="card">
        <h2>Active Recall</h2>
        <p style={{ marginTop: 0 }}>
          Питання в стилі співбесіди. Спершу відповідай вголос, як інтервʼюеру, і тільки потім
          відкривай еталон. Оцінюй чесно: 3 означає, що ти сказав суть, але без прикладу чи деталей.
          Оцінка впливає на дашборд і на те, коли картка повернеться.
        </p>
        <div className="group">
          <span>Тема</span>
          <Chip
            pressed={!filter.topic && !filter.chapter && !filter.due}
            onClick={() => navigate('/recall/all')}
          >
            Усі
          </Chip>
          <Chip pressed={filter.due} onClick={() => navigate('/recall/due')}>
            Пора повторити
          </Chip>
          {idx.catalog.topics.map((t) => (
            <Chip
              key={t.id}
              pressed={filter.topic === t.id}
              onClick={() => navigate(`/recall/${t.id}`)}
            >
              {t.name}
            </Chip>
          ))}
          {filter.chapter && (
            <Chip pressed onClick={() => {}}>
              {idx.chapter.get(filter.chapter)?.title}
            </Chip>
          )}
        </div>
        <div className="group">
          <span>Карток</span>
          {([10, 20, 0] as const).map((c) => (
            <Chip key={c} pressed={count === c} onClick={() => countStore.set(c)}>
              {c || 'Усі'}
            </Chip>
          ))}
        </div>
        <p className="note">
          {scope}: до повторення {pool.due.length}, нових {pool.fresh.length}, відкладених{' '}
          {pool.later.length}. Порядок: спершу ті, що пора повторити (з найнижчою оцінкою), потім
          нові, потім решта.
        </p>
        <div className="actions">
          <div className="left">
            <button
              type="button"
              className="btn primary"
              disabled={!total}
              onClick={() => {
                const all = [...pool.due, ...pool.fresh, ...pool.later];
                onStart(count ? all.slice(0, count) : all);
              }}
            >
              Почати ({count ? Math.min(count, total) : total})
            </button>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Прогрес по темах</h2>
        <div className="tw" style={{ margin: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Тема</th>
                <th>Оцінено</th>
                <th>Середнє</th>
                <th>Пора</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.topicId}>
                  <td>
                    <Link to={`/recall/${r.topicId}`}>{idx.topicName.get(r.topicId)}</Link>
                  </td>
                  <td>
                    {r.recall.rated} / {r.recall.total}
                  </td>
                  <td>{r.recall.rated ? r.recall.avg.toFixed(1) : '–'}</td>
                  <td>{r.recall.due || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="legend">
          Інтервали: 1 і нижче повертається в цій же сесії, 2 через {RECALL_INTERVAL_DAYS[1]} день,
          3 через {RECALL_INTERVAL_DAYS[2]} дні, 4 через тиждень, 5 через два тижні.
        </p>
      </section>
    </div>
  );
}

function SessionView({
  idx,
  session: s,
  onEnd,
}: {
  idx: CatalogIndex;
  session: Session;
  onEnd: () => void;
}) {
  const store = useStore();
  const progress = useProgress();
  const navigate = useNavigate();

  const reveal = () => {
    if (!s.shown) sessionStore.set({ ...s, shown: true });
  };
  /** Saves the rating first (server or local), then moves on. */
  const rate = async (rating: number) => {
    if (!s.shown || s.pending) return;
    const card = s.items[s.i]!;
    sessionStore.set({ ...s, pending: true, error: null });
    try {
      const r = await store.rate(card, rating);
      // "1" comes back later in the same session, once.
      const requeue = rating === 1 && !s.requeued.includes(card.id);
      const at = Math.min(s.i + 4, s.items.length);
      sessionStore.set({
        ...s,
        items: requeue ? [...s.items.slice(0, at), card, ...s.items.slice(at)] : s.items,
        requeued: requeue ? [...s.requeued, card.id] : s.requeued,
        got: [...s.got, { card, rating }],
        xp: s.xp + r.xpGained,
        i: s.i + 1,
        shown: false,
        pending: false,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      sessionStore.set({
        ...s,
        pending: false,
        error: `Не вдалося зберегти оцінку: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  };

  useKeydown((e) => {
    if (s.i >= s.items.length) return;
    if (!s.shown && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      reveal();
    } else if (s.shown && /^[1-5]$/.test(e.key)) void rate(+e.key);
  });

  if (s.i >= s.items.length) {
    const avg = s.got.reduce((n, x) => n + x.rating, 0) / s.got.length;
    const low = [
      ...new Map(s.got.filter((x) => x.rating <= 3).map((x) => [x.card.id, x])).values(),
    ];
    return (
      <div className="card" data-testid="recall-done">
        <div className="meta">
          <span className="tag">Сесія завершена</span>
          {s.xp > 0 && <span className="xpgain">+{s.xp} XP</span>}
        </div>
        <div className="big">{avg.toFixed(1)}</div>
        <p>
          Середня самооцінка за {s.got.length} відповідей.
          {avg >= 4
            ? ' Добре: ці теми можна розповідати на співбесіді.'
            : avg >= 3
              ? ' Суть знаєш, але бракує прикладів і деталей. Перечитай розділи нижче і повтори завтра.'
              : ' Це прогалини, які на співбесіді будуть видні одразу. Почни з теорії по картках нижче.'}
        </p>
        {low.length > 0 && (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Питання</th>
                  <th>Оцінка</th>
                  <th>Теорія</th>
                </tr>
              </thead>
              <tbody>
                {low.map((x) => (
                  <tr key={x.card.id}>
                    <td>
                      <Fmt text={x.card.question} />
                    </td>
                    <td className={x.rating <= 2 ? 'weak' : ''}>{x.rating}</td>
                    <td>
                      <Link to={`/kb/${x.card.topicId}/${x.card.chapterId}`}>
                        {idx.chapter.get(x.card.chapterId)?.title}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <div className="left">
            <button type="button" className="btn primary" onClick={onEnd}>
              Ще сесія
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                onEnd();
                navigate('/dash');
              }}
            >
              До дашборду
            </button>
          </div>
        </div>
      </div>
    );
  }

  const card = s.items[s.i]!;
  const p = progress.cards[card.id];
  const n = s.items.length;
  const ch = idx.chapter.get(card.chapterId);

  return (
    <>
      <div className="top">
        <span>
          Картка {s.i + 1} з {n}
        </span>
        <span>{p ? `Остання оцінка ${p.rating} · повторів ${p.reviews}` : 'Нова картка'}</span>
      </div>
      <div className="bar">
        <span style={{ width: `${(s.i / n) * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div className="card" data-testid="recall-card">
        <div className="meta">
          <span className="tag">{idx.topicName.get(card.topicId)}</span>
          <span className="lvl">{card.group}</span>
        </div>
        <p className="rq">
          <Fmt text={card.question} />
        </p>
        <p className="note">
          Відповідай вголос 1–2 хвилини. Структура: визначення, як це працює, приклад з практики,
          підводні камені.
        </p>
        {!s.shown ? (
          <div className="actions qactions">
            <div className="left">
              <button type="button" className="btn primary" onClick={reveal}>
                Показати відповідь
              </button>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => sessionStore.set({ ...s, items: s.items.slice(0, s.i) })}
            >
              Завершити
            </button>
          </div>
        ) : (
          <div className="ans">
            <h3>Еталонна відповідь</h3>
            <p>
              <Fmt text={card.answer} />
            </p>
            {ch && (
              <Link className="golink" to={`/kb/${ch.topicId}/${ch.id}`}>
                Детальніше: {ch.title} →
              </Link>
            )}
            <h3 style={{ marginTop: 16 }}>Наскільки добре ти відповів?</h3>
            <div className="rate">
              {RATES.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={`r${v}`}
                  disabled={s.pending}
                  onClick={() => void rate(v)}
                >
                  {v}
                  <small>{label}</small>
                </button>
              ))}
            </div>
            {s.error && (
              <p className="err" role="alert">
                {s.error}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
