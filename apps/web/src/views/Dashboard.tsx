import { useMemo } from 'react';
import { Link } from 'react-router';
import { chapterScores, topicBadge, topicSkills, WEAK_THRESHOLD } from '@qa-hub/shared';
import { useCatalog, useCatalogIndex } from '../hooks/content';
import { useNow } from '../lib/stores';
import { LoadError, Loading, pct, scoreColor } from '../lib/ui';
import { useSkillProgress } from '../progress/ProgressProvider';
import { TodayCard } from './TodayCard';

const BADGE_LABEL = { gold: 'Золото', silver: 'Срібло', bronze: 'Бронза' } as const;

export function Dashboard() {
  const { data: catalog, error, refetch } = useCatalog();
  const idx = useCatalogIndex(catalog);
  const progress = useSkillProgress();
  const now = useNow();

  const view = useMemo(() => {
    if (!catalog) return null;
    const skills = topicSkills(catalog, progress, now);
    const weak = chapterScores(catalog, progress, now)
      .filter((c) => c.score < WEAK_THRESHOLD)
      .slice(0, 14);
    const due = Object.values(progress.cards).filter((c) => c.dueAt <= now).length;
    const chaptersWithCards = new Set(catalog.recallCards.map((c) => c.chapterId));
    return { skills, weak, due, chaptersWithCards };
  }, [catalog, progress, now]);

  if (error) return <LoadError error={error} retry={() => void refetch()} />;
  if (!idx || !view) return <Loading />;

  const untested = view.skills.filter((s) => !s.tested).map((s) => idx.topicName.get(s.topicId));

  return (
    <>
      <TodayCard catalog={idx.catalog} />
      <div className="dgrid">
        {view.skills.map((s) => {
          const q = s.quiz;
          const r = s.recall;
          return (
            <div className="sk" key={s.topicId} data-testid={`skill-${s.topicId}`}>
              <div className="hd">
                <b>
                  {idx.topicName.get(s.topicId)}{' '}
                  {s.tested && topicBadge(s.skill) && (
                    <span
                      className={`badge ${topicBadge(s.skill)}`}
                      title="Нагорода за рівень теми"
                    >
                      {BADGE_LABEL[topicBadge(s.skill)!]}
                    </span>
                  )}
                </b>
                {s.tested ? (
                  <span className="pct" style={{ color: scoreColor(s.skill) }}>
                    {pct(s.skill)}
                  </span>
                ) : (
                  <span className="pct none">не перевірено</span>
                )}
              </div>
              <div className="lvlbar">
                <span style={{ width: `${s.skill * 100}%`, background: scoreColor(s.skill) }} />
              </div>
              <div className="ln">
                Тести: {q.correct} з {q.total} правильно
                {q.answered > 0 && ` (точність ${pct(q.correct / q.answered)})`}
              </div>
              <div className="ln">
                Recall: оцінено {r.rated} з {r.total}
                {r.rated > 0 && `, середнє ${r.avg.toFixed(1)}`}
              </div>
              <div className="lnk">
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
              </div>
            </div>
          );
        })}
      </div>

      <div className="two">
        <section className="card">
          <h2>Слабкі теми: повторити</h2>
          <div className="wl">
            {view.weak.length ? (
              view.weak.map((x) => {
                const bits: string[] = [];
                if (x.quiz.answered) bits.push(`тести ${x.quiz.correct}/${x.quiz.answered}`);
                if (x.recall.rated) bits.push(`recall ${x.recall.avg.toFixed(1)} з 5`);
                return (
                  <div className="wi" key={x.chapterId}>
                    <span className="t">{idx.chapter.get(x.chapterId)?.title}</span>
                    <span className="s">
                      {idx.topicName.get(x.topicId)} · {bits.join(' · ')} ·{' '}
                      <span style={{ color: scoreColor(x.score) }}>{pct(x.score)}</span>
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
                  </div>
                );
              })
            ) : (
              <p className="note">
                Поки порожньо. Список зʼявиться, коли пройдеш тести або оціниш картки Recall: сюди
                потрапляють розділи з точністю нижче 70% (мінімум 2 відповіді в тестах) або з
                низькою самооцінкою.
              </p>
            )}
          </div>
        </section>
        <section className="card">
          <h2>Як рахується</h2>
          <p className="legend" style={{ marginTop: 0 }}>
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
          <div className="actions">
            <div className="left">
              {view.due ? (
                <Link className="btn primary" to="/recall/due">
                  Повторити в Recall ({view.due})
                </Link>
              ) : (
                <Link className="btn primary" to="/recall">
                  Відкрити Active Recall
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
