import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { chapterScores, topicBadge, topicSkills, WEAK_THRESHOLD } from '@qa-hub/shared';
import { useCatalog, useCatalogIndex } from '../hooks/content';
import { PlayIcon } from '../lib/icons';
import { useNow } from '../lib/stores';
import { TopicIcon } from '../lib/topic-icons';
import { LoadError, Loading, pct, scoreColor } from '../lib/ui';
import { useSkillProgress } from '../progress/ProgressProvider';
import { TodayCard } from './TodayCard';

/** Weak chapters shown before "show all": keeps the card level with Today. */
const WEAK_VISIBLE = 4;

const BADGE_LABEL = { gold: 'Золото', silver: 'Срібло', bronze: 'Бронза' } as const;

function Meter({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <span className="meter">
      <span className="lvlbar" aria-hidden>
        <span style={{ width: `${value * 100}%`, background: color }} />
      </span>
      <span className="v">{label}</span>
    </span>
  );
}

export function Dashboard() {
  const { data: catalog, error, refetch } = useCatalog();
  const idx = useCatalogIndex(catalog);
  const progress = useSkillProgress();
  const now = useNow();
  const [allWeak, setAllWeak] = useState(false);

  const view = useMemo(() => {
    if (!catalog) return null;
    const skills = topicSkills(catalog, progress, now);
    const weak = chapterScores(catalog, progress, now)
      .filter((c) => c.score < WEAK_THRESHOLD)
      .slice(0, 14);
    const due = Object.values(progress.cards).filter((c) => c.dueAt <= now).length;
    const chaptersWithCards = new Set(catalog.recallCards.map((c) => c.chapterId));
    let questions = 0;
    let correct = 0;
    let cards = 0;
    let rated = 0;
    for (const s of skills) {
      questions += s.quiz.total;
      correct += s.quiz.correct;
      cards += s.recall.total;
      rated += s.recall.rated;
    }
    return { skills, weak, due, chaptersWithCards, totals: { questions, correct, cards, rated } };
  }, [catalog, progress, now]);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!idx || !view) return <Loading />;

  const { totals } = view;
  const untested = view.skills.filter((s) => !s.tested).map((s) => idx.topicName.get(s.topicId));

  return (
    <div className="dash">
      <div className="runhead">
        <div>
          <p className="prompt">$ npx qa-hub run --today</p>
          <h1>QA Interview Preparation Hub</h1>
          <p className="summary">
            <span>
              Тести: <b className="ok">{totals.correct} passed</b> з {totals.questions}
            </span>
            <span>
              Recall: <b className="info">{totals.rated} оцінено</b> з {totals.cards}
            </span>
            <span>Suites: {view.skills.length}</span>
          </p>
        </div>
        {view.due ? (
          <Link className="btn primary cta" to="/recall/due">
            <PlayIcon /> Повторити в Recall ({view.due})
          </Link>
        ) : (
          <Link className="btn primary cta" to="/quiz">
            <PlayIcon /> Почати тест
          </Link>
        )}
      </div>

      <div className="two">
        <TodayCard catalog={idx.catalog} />
        <section className="card failing" aria-labelledby="weak-h">
          <h2 id="weak-h">
            Слабкі теми: повторити{' '}
            {view.weak.length > 0 && <span className="count">{view.weak.length} failing</span>}
          </h2>
          {view.weak.length ? (
            <>
              <ul className="wl">
                {(allWeak ? view.weak : view.weak.slice(0, WEAK_VISIBLE)).map((x) => {
                  const bits: string[] = [];
                  if (x.quiz.answered) bits.push(`тести ${x.quiz.correct}/${x.quiz.answered}`);
                  if (x.recall.rated) bits.push(`recall ${x.recall.avg.toFixed(1)} з 5`);
                  return (
                    <li className="wi" key={x.chapterId}>
                      <span className="mark" style={{ color: scoreColor(x.score) }}>
                        ✗ {pct(x.score)}
                      </span>
                      <span className="t">{idx.chapter.get(x.chapterId)?.title}</span>
                      <span className="s">
                        {idx.topicName.get(x.topicId)} · {bits.join(' · ')}
                      </span>
                      <span className="b">
                        <Link className="btn sm" to={`/kb/${x.topicId}/${x.chapterId}`}>
                          Теорія
                        </Link>
                        {view.chaptersWithCards.has(x.chapterId) && (
                          <Link className="btn sm" to={`/recall/ch/${x.chapterId}`}>
                            Recall
                          </Link>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {view.weak.length > WEAK_VISIBLE && (
                <button
                  type="button"
                  className="btn sm ghost morebtn"
                  aria-expanded={allWeak}
                  onClick={() => setAllWeak((v) => !v)}
                >
                  {allWeak ? 'Згорнути' : `Показати всі (${view.weak.length})`}
                </button>
              )}
            </>
          ) : (
            <p className="note">
              <span className="mono ok">0 failing.</span> Список зʼявиться, коли пройдеш тести або
              оціниш картки Recall: сюди потрапляють розділи з точністю нижче 70% (мінімум 2
              відповіді в тестах) або з низькою самооцінкою.
            </p>
          )}
        </section>
      </div>

      <section className="card specs" aria-labelledby="topics-h">
        <div className="specs-head">
          <h2 id="topics-h">Теми</h2>
          <span className="note mono">Рівень теми = 50% тести + 50% Active Recall</span>
        </div>
        <div className="spec spec-cols" aria-hidden>
          <span>Spec</span>
          <span>Тести</span>
          <span>Recall</span>
          <span className="lv">Рівень</span>
          <span />
        </div>
        {view.skills.map((s) => {
          const q = s.quiz;
          const r = s.recall;
          const badge = s.tested ? topicBadge(s.skill) : null;
          return (
            <div className="spec" key={s.topicId} data-testid={`skill-${s.topicId}`}>
              <span className="nm">
                <span className="ibox">
                  <TopicIcon id={s.topicId} />
                </span>
                <b>{s.topicId}.spec</b>
                <small>{idx.topicName.get(s.topicId)}</small>
              </span>
              <span className="qz">
                <small className="lbl-sm">Тести</small>
                <Meter
                  value={q.total ? q.correct / q.total : 0}
                  color="var(--ok)"
                  label={`${q.correct}/${q.total}`}
                />
              </span>
              <span className="rc">
                <small className="lbl-sm">Recall</small>
                <Meter value={r.score} color="var(--info)" label={`${r.rated}/${r.total}`} />
              </span>
              <span className="lv">
                {s.tested ? (
                  <>
                    <b style={{ color: scoreColor(s.skill) }}>{pct(s.skill)}</b>
                    {badge && (
                      <span className={`badge ${badge}`} title="Нагорода за рівень теми">
                        {BADGE_LABEL[badge]}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="none">не перевірено</span>
                )}
              </span>
              <span className="lnk">
                <Link
                  className="btn sm"
                  to={`/quiz/${idx.sectionsByTopic.get(s.topicId)?.[0] ?? ''}`}
                >
                  Тести
                </Link>
                <Link className="btn sm" to={`/recall/${s.topicId}`}>
                  Recall
                </Link>
                <Link className="btn sm" to={`/kb/${s.topicId}`}>
                  Теорія
                </Link>
              </span>
            </div>
          );
        })}
        <details className="howto">
          <summary>Як рахується</summary>
          <p className="legend">
            Рівень теми = 50% тести + 50% Active Recall. Тести: частка питань теми, на які остання
            відповідь правильна (не пройдені рахуються як 0). Recall: середня самооцінка по всіх
            картках теми, де 1 = 0%, 5 = 100%, неоцінені = 0. Тобто 100% означає: усі тести пройдені
            правильно і всі картки оцінені на 5.
          </p>
          <p className="legend">Code review тренажери входять у Playwright і TypeScript.</p>
          {untested.length > 0 && (
            <p className="legend">
              <b>Не перевірено:</b> {untested.join(', ')}.
            </p>
          )}
        </details>
      </section>
    </div>
  );
}
