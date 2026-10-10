import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  OK_TEXT,
  type CatalogSection,
  type CheckAnswerResponse,
  type Level,
  type QuizQuestion,
} from '@qa-hub/shared';
import {
  useCatalog,
  useCatalogIndex,
  useSectionQuestions,
  type CatalogIndex,
} from '../hooks/content';
import { Chip, Fmt, LoadError, Loading, shuffled, useKeydown } from '../lib/ui';
import { TopicIcon } from '../lib/topic-icons';
import { useProgress, useStore } from '../progress/ProgressProvider';

/* ---------- per-section session state (kept while switching tabs, like the legacy page) ---------- */

type Verdict = 'y' | 'n' | 's';
interface Setup {
  level: 'all' | Level;
  /** null = all groups */
  groups: string[] | null;
  count: 10 | 20 | 0;
}
interface Run {
  ids: string[];
  i: number;
  res: Record<string, Verdict>;
  /** Display order of the current question's options (indexes into `options`). */
  order: number[];
  answer: { choice: number | null; check: CheckAnswerResponse; xp: number } | null;
  pending: boolean;
  error: string | null;
  done: boolean;
  /** XP from finishing the run (quiz bonus, tasks), recorded once when it ends. */
  bonus: number;
}
interface Session {
  setup: Setup;
  run: Run | null;
}

const sessions = new Map<string, Session>();
const newSession = (): Session => ({ setup: { level: 'all', groups: null, count: 10 }, run: null });

function useSession(sectionId: string) {
  const [, setTick] = useState(0);
  const session = sessions.get(sectionId) ?? newSession();
  const update = (fn: (s: Session) => Session) => {
    sessions.set(sectionId, fn(sessions.get(sectionId) ?? newSession()));
    setTick((t) => t + 1);
  };
  return [session, update] as const;
}

function optionOrder(q: QuizQuestion): number[] {
  const ok = q.options.indexOf(OK_TEXT);
  const rest = shuffled(q.options.map((_, i) => i).filter((i) => i !== ok));
  return ok >= 0 ? [...rest, ok] : rest;
}

/* ---------- page ---------- */

export function Quiz() {
  const { sectionId: param } = useParams();
  const { data: catalog, error, refetch } = useCatalog();
  const idx = useCatalogIndex(catalog);
  const progress = useProgress();
  const store = useStore();

  const fallback = progress.lastSection ?? catalog?.sections[0]?.id;
  const section =
    catalog?.sections.find((s) => s.id === (param ?? fallback)) ?? catalog?.sections[0];

  useEffect(() => {
    if (section) store.setLastSection(section.id);
  }, [section, store]);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!idx || !section) return <Loading />;

  return (
    <>
      <SectionTabs idx={idx} current={section.id} />
      <SectionView key={section.id} idx={idx} section={section} />
    </>
  );
}

function SectionTabs({ idx, current }: { idx: CatalogIndex; current: string }) {
  const navigate = useNavigate();
  const { questions } = useProgress();
  const stats = useMemo(() => {
    const out = new Map<string, { n: number; y: number; b: number }>();
    for (const q of idx.catalog.questions) {
      const s = out.get(q.sectionId) ?? { n: 0, y: 0, b: 0 };
      s.n++;
      const r = questions[q.id]?.lastResult;
      if (r === 1) s.y++;
      else if (r === 0) s.b++;
      out.set(q.sectionId, s);
    }
    return out;
  }, [idx, questions]);

  return (
    <nav className="tabs" id="tabs" role="tablist">
      {idx.catalog.sections.map((s) => {
        const st = stats.get(s.id) ?? { n: 0, y: 0, b: 0 };
        const w = (v: number) => `${st.n ? (v / st.n) * 100 : 0}%`;
        return (
          <button
            key={s.id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={s.id === current}
            onClick={() => navigate(`/quiz/${s.id}`)}
          >
            <small className="desc">
              {s.description} · {st.n}
            </small>
            <b className="tname">
              <TopicIcon id={s.id} size={16} />
              {s.name}
            </b>
            <small>
              {st.y} з {st.n} правильно
            </small>
            <span className="mini">
              <span style={{ width: w(st.y), background: 'var(--ok)' }} />
              <span style={{ width: w(st.b), background: 'var(--bad)' }} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function SectionView({ idx, section }: { idx: CatalogIndex; section: CatalogSection }) {
  const { data: questions, error, refetch } = useSectionQuestions(section.id);
  const [session, update] = useSession(section.id);
  const [params, setParams] = useSearchParams();

  // "Тести з розділу" from the KB: preselect the groups that belong to that chapter.
  const ch = params.get('ch');
  useEffect(() => {
    if (!ch || !questions) return;
    const groups = [...new Set(questions.filter((q) => q.chapterId === ch).map((q) => q.group))];
    if (groups.length) update(() => ({ setup: { level: 'all', groups, count: 10 }, run: null }));
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, questions]);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!questions) return <Loading />;

  const byId = new Map(questions.map((q) => [q.id, q]));
  const start = (ids: string[]) =>
    update((s) => ({
      ...s,
      run: {
        ids,
        i: 0,
        res: {},
        order: ids[0] ? optionOrder(byId.get(ids[0])!) : [],
        answer: null,
        pending: false,
        error: null,
        done: ids.length === 0,
        bonus: 0,
      },
    }));

  return (
    <div id="qv">
      {session.run && !session.run.done ? (
        <RunView
          idx={idx}
          section={section}
          byId={byId}
          run={session.run}
          update={(fn) => update((s) => ({ ...s, run: s.run && fn(s.run) }))}
        />
      ) : session.run?.ids.length ? (
        <Results
          idx={idx}
          byId={byId}
          run={session.run}
          onRedo={(ids) => start(shuffled(ids))}
          onAgain={() => update((s) => ({ ...s, run: null }))}
        />
      ) : (
        <SetupView
          section={section}
          questions={questions}
          setup={session.setup}
          onSetup={(setup) => update((s) => ({ ...s, setup }))}
          onStart={start}
        />
      )}
      <WipeButton
        section={section}
        questions={questions}
        onWiped={() => update(() => newSession())}
      />
    </div>
  );
}

/* ---------- setup ---------- */

function SetupView({
  section,
  questions,
  setup,
  onSetup,
  onStart,
}: {
  section: CatalogSection;
  questions: QuizQuestion[];
  setup: Setup;
  onSetup: (s: Setup) => void;
  onStart: (ids: string[]) => void;
}) {
  const progress = useProgress();
  const groups = [...new Set(questions.map((q) => q.group))];
  const selected = new Set(setup.groups ?? groups);
  const allGroups = !setup.groups || selected.size === groups.length;
  const pool = questions.filter(
    (q) => (setup.level === 'all' || q.level === setup.level) && selected.has(q.group),
  );
  const weak = questions.filter((q) => progress.questions[q.id]?.lastResult === 0);
  const total = setup.count ? Math.min(setup.count, pool.length) : pool.length;
  const attempts = (progress.attempts[section.id] ?? []).slice(0, 5);

  const toggleGroup = (g: string) => {
    if (allGroups) return onSetup({ ...setup, groups: [g] });
    const next = new Set(selected);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    onSetup({ ...setup, groups: next.size ? [...next] : null });
  };

  return (
    <div className="card">
      <h2>{section.name}: налаштування спроби</h2>
      <div className="group">
        <span>Рівень</span>
        {(['all', 'junior', 'middle', 'senior'] as const).map((l) => (
          <Chip key={l} pressed={setup.level === l} onClick={() => onSetup({ ...setup, level: l })}>
            {l === 'all' ? 'Усі' : l}
          </Chip>
        ))}
      </div>
      <div className="group">
        <span>Теми</span>
        <Chip pressed={allGroups} onClick={() => onSetup({ ...setup, groups: null })}>
          Усі теми
        </Chip>
        {groups.map((g) => (
          <Chip key={g} pressed={!allGroups && selected.has(g)} onClick={() => toggleGroup(g)}>
            {g}
          </Chip>
        ))}
      </div>
      <div className="group">
        <span>Питань</span>
        {([10, 20, 0] as const).map((c) => (
          <Chip key={c} pressed={setup.count === c} onClick={() => onSetup({ ...setup, count: c })}>
            {c || 'Усі'}
          </Chip>
        ))}
      </div>
      <div className="actions">
        <div className="left">
          <button
            type="button"
            className="btn primary"
            disabled={!pool.length}
            onClick={() => {
              const ids = shuffled(pool).map((q) => q.id);
              onStart(setup.count ? ids.slice(0, setup.count) : ids);
            }}
          >
            Почати ({total})
          </button>
          <button
            type="button"
            className="btn"
            disabled={!weak.length}
            onClick={() => onStart(shuffled(weak).map((q) => q.id))}
          >
            Слабкі місця ({weak.length})
          </button>
        </div>
      </div>
      <p className="note" style={{ marginTop: 14 }}>
        Слабкі місця: питання, на які остання відповідь була неправильна або пропущена. Після кожної
        відповіді є посилання на розділ Knowledge Base з теорією.
      </p>
      {attempts.length > 0 && (
        <p className="note">
          Останні спроби:
          {attempts.map((a) => (
            <span key={a.at}>
              <br />
              {new Date(a.at).toLocaleString('uk-UA', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
              : {a.y} з {a.n}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/* ---------- running quiz ---------- */

function ProgressBar({ run }: { run: Run }) {
  const n = run.ids.length;
  const v = Object.values(run.res);
  const c = (k: Verdict) => v.filter((x) => x === k).length;
  const w = (k: Verdict) => `${n ? (c(k) / n) * 100 : 0}%`;
  return (
    <>
      <div className="top">
        <span>{run.i < n && !run.done ? `Питання ${run.i + 1} з ${n}` : 'Завершено'}</span>
        <span>
          Правильно {c('y')} · Помилки {c('n')} · Пропущено {c('s')}
        </span>
      </div>
      <div className="bar">
        <span style={{ width: w('y'), background: 'var(--ok)' }} />
        <span style={{ width: w('n'), background: 'var(--bad)' }} />
        <span style={{ width: w('s'), background: 'var(--warn)' }} />
      </div>
    </>
  );
}

function KbLink({
  idx,
  chapterId,
  label = 'Теорія',
}: {
  idx: CatalogIndex;
  chapterId: string;
  label?: string;
}) {
  const ch = idx.chapter.get(chapterId);
  if (!ch) return null;
  return (
    <Link className="golink" to={`/kb/${ch.topicId}/${ch.id}`}>
      {label}: {ch.title} →
    </Link>
  );
}

function RunView({
  idx,
  section,
  byId,
  run,
  update,
}: {
  idx: CatalogIndex;
  section: CatalogSection;
  byId: Map<string, QuizQuestion>;
  run: Run;
  update: (fn: (r: Run) => Run) => void;
}) {
  const store = useStore();
  const nextRef = useRef<HTMLButtonElement>(null);
  const q = byId.get(run.ids[run.i]!)!;
  const topicId = idx.topicOfSection.get(section.id)!;

  const choose = async (k: number | null) => {
    if (run.answer || run.pending) return;
    const choice = k === null ? null : run.order[k]!;
    update((r) => ({ ...r, pending: true, error: null }));
    try {
      const { check, result } = await store.answer(q, topicId, choice);
      const verdict: Verdict =
        check.outcome === 'correct' ? 'y' : check.outcome === 'wrong' ? 'n' : 's';
      // Only the answer's own XP here; task/streak bonuses get their own notifications.
      const answerXp = result.grants
        .filter((g) => g.reason === 'answer_first_correct' || g.reason === 'answer_repeat')
        .reduce((n, g) => n + g.amount, 0);
      update((r) => ({
        ...r,
        pending: false,
        answer: { choice, check, xp: answerXp },
        res: { ...r.res, [q.id]: verdict },
      }));
      setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 0);
    } catch (e) {
      update((r) => ({
        ...r,
        pending: false,
        error: `Не вдалося перевірити відповідь: ${e instanceof Error ? e.message : String(e)}`,
      }));
    }
  };

  /** Records the attempt (quiz bonus + ACCURACY task) when a run with answers ends. */
  /** Records the run once; the bonus shows up on the results card when it arrives. */
  const finish = (ids: string[]) => {
    if (!ids.length) return;
    store.finishQuiz(section.id, ids).then(
      (r) => update((prev) => ({ ...prev, bonus: r.xpGained })),
      (e: unknown) => console.warn('finishQuiz failed', e),
    );
  };

  const next = () => {
    const i = run.i + 1;
    if (i >= run.ids.length) {
      finish(run.ids);
      update((r) => ({ ...r, i, answer: null, done: true }));
    } else {
      const nq = byId.get(run.ids[i]!)!;
      update((r) => ({ ...r, i, answer: null, error: null, order: optionOrder(nq) }));
    }
    document.getElementById('tabs')?.scrollIntoView({ behavior: 'smooth' });
  };

  const stop = () => {
    const ids = run.ids.slice(0, run.i + (run.answer ? 1 : 0));
    finish(ids);
    update((r) => ({ ...r, ids, i: ids.length, done: true }));
  };

  useKeydown((e) => {
    if (!run.answer) {
      if (/^[1-9]$/.test(e.key) && +e.key <= run.order.length) void choose(+e.key - 1);
      else if (e.key === 's' || e.key === 'S' || e.key === '0') void choose(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      next();
    }
  });

  const a = run.answer;
  const verdict =
    a && (a.check.outcome === 'correct' ? 'y' : a.check.outcome === 'wrong' ? 'n' : 's');

  return (
    <>
      <ProgressBar run={run} />
      <div className="card" data-testid="question">
        <div className="meta">
          <span className="tag">
            <span className="k">group:</span> {q.group}
          </span>
          <span className="lvl">
            <span className="k">level:</span> {q.level}
          </span>
        </div>
        <h2>
          <Fmt text={q.text} />
        </h2>
        {q.code && (
          <pre>
            <code>{q.code}</code>
          </pre>
        )}
        <div className="opts">
          {run.order.map((o, k) => {
            const right = a && o === a.check.correctIndex;
            const wrong = a && a.choice === o && !right;
            return (
              <button
                key={o}
                type="button"
                className={`opt${right ? ' right' : ''}${wrong ? ' wrong' : ''}`}
                disabled={!!a || run.pending}
                onClick={() => void choose(k)}
              >
                <b>{k + 1}</b>
                <span>
                  <Fmt text={q.options[o]!} />
                </span>
              </button>
            );
          })}
        </div>
        {run.error && (
          <p className="err" role="alert">
            {run.error}
          </p>
        )}
        {a && verdict && (
          <div className="ex">
            <div className={`verdict ${verdict}`}>
              {{ y: 'Правильно', n: 'Неправильно', s: 'Пропущено' }[verdict]}
              {a.xp > 0 && <span className="xpgain">+{a.xp} XP</span>}
            </div>
            <Fmt text={a.check.explanation} />
            <br />
            <KbLink idx={idx} chapterId={q.chapterId} />
          </div>
        )}
        <div className="actions qactions">
          {!a ? (
            <button
              type="button"
              className="btn ghost"
              disabled={run.pending}
              onClick={() => void choose(null)}
            >
              Пропустити
            </button>
          ) : (
            <span />
          )}
          <div className="left">
            <button type="button" className="btn" onClick={stop}>
              Завершити спробу
            </button>
            {a && (
              <button type="button" className="btn primary" ref={nextRef} onClick={next}>
                Далі
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- results ---------- */

function Results({
  idx,
  byId,
  run,
  onRedo,
  onAgain,
}: {
  idx: CatalogIndex;
  byId: Map<string, QuizQuestion>;
  run: Run;
  onRedo: (ids: string[]) => void;
  onAgain: () => void;
}) {
  const n = run.ids.length;
  const y = run.ids.filter((id) => run.res[id] === 'y').length;
  const pctDone = Math.round((y / n) * 100);

  const by = new Map<string, { y: number; a: number; chapterId: string }>();
  for (const id of run.ids) {
    const q = byId.get(id)!;
    const s = by.get(q.group) ?? { y: 0, a: 0, chapterId: q.chapterId };
    s.a++;
    if (run.res[id] === 'y') s.y++;
    by.set(q.group, s);
  }
  const rows = [...by.entries()].sort((a, b) => a[1].y / a[1].a - b[1].y / b[1].a);
  const missed = run.ids.filter((id) => run.res[id] !== 'y');
  const verdict =
    pctDone >= 85
      ? 'Впевнений рівень. Закріпи в Active Recall: розкажи ці теми вголос.'
      : pctDone >= 65
        ? 'Середній рівень. Відкрий теорію для тем з таблиці нижче 70%, а не проходь весь тест знову.'
        : 'Слабко для Senior. Пройди помилки, прочитай розділи з таблиці і поясни їх вголос в Active Recall.';

  return (
    <>
      <ProgressBar run={run} />
      <div className="card" data-testid="results">
        <div className="meta">
          <span className="tag">Результат</span>
          {run.bonus > 0 && <span className="xpgain">+{run.bonus} XP бонус</span>}
        </div>
        <div
          className="big"
          style={{
            color: pctDone >= 85 ? 'var(--ok)' : pctDone >= 65 ? 'var(--warn)' : 'var(--bad)',
          }}
        >
          {pctDone}%
        </div>
        <p className="runline">
          <span className="ok">{y} passed</span>, <span className="bad">{n - y} failed</span> ·
          Tests: {n} total
        </p>
        <p>
          {y} правильних з {n}. {verdict}
        </p>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Тема</th>
                <th>Правильно</th>
                <th>%</th>
                <th>Теорія</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([group, s]) => {
                const p = Math.round((s.y / s.a) * 100);
                const ch = idx.chapter.get(s.chapterId);
                return (
                  <tr key={group}>
                    <td>{group}</td>
                    <td>
                      {s.y} / {s.a}
                    </td>
                    <td className={p < 70 ? 'weak' : ''}>{p}%</td>
                    <td>{ch && <Link to={`/kb/${ch.topicId}/${ch.id}`}>{ch.title}</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <div className="left">
            <button
              type="button"
              className="btn primary"
              disabled={!missed.length}
              onClick={() => onRedo(missed)}
            >
              Пройти помилки й пропуски ще раз ({missed.length})
            </button>
            <button type="button" className="btn" onClick={onAgain}>
              Нова спроба
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- wipe ---------- */

function WipeButton({
  section,
  questions,
  onWiped,
}: {
  section: CatalogSection;
  questions: QuizQuestion[];
  onWiped: () => void;
}) {
  const store = useStore();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="actions" style={{ justifyContent: 'flex-end' }}>
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (!armed) return setArmed(true);
          setArmed(false);
          void store
            .resetSection(
              section.id,
              questions.map((q) => q.id),
            )
            .then(onWiped);
        }}
      >
        {armed ? 'Точно? Натисни ще раз' : 'Очистити прогрес цієї секції'}
      </button>
    </div>
  );
}
