import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { LEVEL_TITLES, RECALL_INTERVAL_DAYS, XP_RULES } from '@qa-hub/shared';
import { useT } from '../i18n';
import { BookIcon, DashIcon, QuizIcon, RecallIcon } from '../lib/icons';

/** Icon and target of each flow step; the wording comes from the messages, in the same order. */
const STEPS: { icon: ReactNode; to: string }[] = [
  { icon: <DashIcon />, to: '/dash' },
  { icon: <QuizIcon />, to: '/quiz' },
  { icon: <RecallIcon />, to: '/recall' },
  { icon: <BookIcon />, to: '/kb' },
];

export function Tutorial() {
  const t = useT();
  const m = t.tutorial;
  const levels = LEVEL_TITLES.map((l) => `${l.title} (${l.from})`).join(' → ');
  return (
    <div className="dash tutorial">
      <div className="runhead">
        <div>
          <p className="prompt">$ qa-hub --help</p>
          <h1>{m.title}</h1>
          <p className="sub">{m.lead}</p>
        </div>
      </div>

      <section aria-labelledby="flow-h">
        <h2 id="flow-h">{m.flow}</h2>
        <ol className="steps">
          {m.steps.map((s, i) => (
            <li className="card step" key={s.title}>
              <div className="step-head">
                <span className="ibox">{STEPS[i]!.icon}</span>
                <span className="mono step-n">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="step-t">{s.title}</h3>
              </div>
              <p>{s.text}</p>
              <Link className="btn sm" to={STEPS[i]!.to}>
                {s.cta}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cases-h">
        <h2 id="cases-h">{m.cases}</h2>
        <div className="cases">
          {m.caseList.map((c) => (
            <article className="card case" key={c.title}>
              <h3 className="case-t">{c.title}</h3>
              <p className="note">{c.when}</p>
              <ol>
                {c.steps.map((st, i) => (
                  <li key={i}>{st}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <div className="two">
        <section className="card" aria-labelledby="xp-h">
          <h2 id="xp-h">{m.xpTitle}</h2>
          <div className="tw">
            <table>
              <tbody>
                <tr>
                  <td>{m.xpFirst}</td>
                  <td className="mono">
                    +{XP_RULES.firstCorrect.junior} / +{XP_RULES.firstCorrect.middle} / +
                    {XP_RULES.firstCorrect.senior} XP
                  </td>
                </tr>
                <tr>
                  <td>{m.xpRepeat}</td>
                  <td className="mono">+{XP_RULES.repeatCorrect} XP</td>
                </tr>
                <tr>
                  <td>{m.xpRecall}</td>
                  <td className="mono">
                    +{XP_RULES.recallDue} (+{XP_RULES.recallDueGood}) XP
                  </td>
                </tr>
                <tr>
                  <td>{m.xpArticle}</td>
                  <td className="mono">+{XP_RULES.articleFirstRead} XP</td>
                </tr>
                <tr>
                  <td>
                    {m.xpQuiz(
                      XP_RULES.quizBonusMinAnswered,
                      Math.round(XP_RULES.quizBonusMinRatio * 100),
                    )}
                  </td>
                  <td className="mono">+{XP_RULES.quizBonus} XP</td>
                </tr>
                <tr>
                  <td>{m.xpDaily}</td>
                  <td className="mono">+{XP_RULES.dailyAllDone} XP</td>
                </tr>
                <tr>
                  <td>{m.xpStreak}</td>
                  <td className="mono">
                    {m.xpStreakValue(XP_RULES.streakPerDay, XP_RULES.streakCap)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="legend">
            <b>{m.levels}</b> {levels}.
          </p>
        </section>

        <section className="card" aria-labelledby="rules-h">
          <h2 id="rules-h">{m.rules}</h2>
          <ul className="rules">
            <li>{m.ruleLevel}</li>
            <li>
              <b>{m.ruleBadges}</b> <span className="badge bronze">{t.dash.badge.bronze}</span>{' '}
              {m.from} 60%, <span className="badge silver">{t.dash.badge.silver}</span> {m.from}{' '}
              75%, <span className="badge gold">{t.dash.badge.gold}</span> {m.from} 90%.
            </li>
            <li>{m.ruleRecall(RECALL_INTERVAL_DAYS[1], RECALL_INTERVAL_DAYS[2])}</li>
            <li>{m.ruleDaily}</li>
            <li>{m.ruleGuest}</li>
            <li>
              <b>{m.keys}</b> {m.keysQuiz} <span className="kbd">1–4</span> {m.keysAnswer},{' '}
              <span className="kbd">S</span> {m.keysSkip}, <span className="kbd">Enter</span>{' '}
              {m.keysNext}; {m.keysRecall} <span className="kbd">{m.keysSpace}</span> {m.keysReveal}
              , <span className="kbd">1–5</span> {m.keysRate}.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
