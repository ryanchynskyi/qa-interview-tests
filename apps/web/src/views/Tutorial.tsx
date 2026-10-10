import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { LEVEL_TITLES, RECALL_INTERVAL_DAYS, XP_RULES } from '@qa-hub/shared';
import { BookIcon, DashIcon, QuizIcon, RecallIcon } from '../lib/icons';

const STEPS: {
  n: string;
  icon: ReactNode;
  title: string;
  to: string;
  cta: string;
  text: string;
}[] = [
  {
    n: '01',
    icon: <DashIcon />,
    title: 'Дашборд',
    to: '/dash',
    cta: 'Відкрити дашборд',
    text: 'Звідси починається день: три завдання дня, серія, слабкі розділи й рівень кожної теми. Кнопка вгорі веде туди, де зараз найбільше користі.',
  },
  {
    n: '02',
    icon: <QuizIcon />,
    title: 'Тести',
    to: '/quiz',
    cta: 'Пройти тест',
    text: 'Обери тему, рівень (junior / middle / senior), підтеми й кількість питань. Після кожної відповіді є пояснення і посилання на теорію. «Слабкі місця» збирають питання, де остання відповідь була неправильна або пропущена.',
  },
  {
    n: '03',
    icon: <RecallIcon />,
    title: 'Active Recall',
    to: '/recall',
    cta: 'Повторити картки',
    text: 'Питання як на співбесіді. Спершу відповідай вголос 1–2 хвилини, потім відкрий еталон і чесно оціни себе від 1 до 5. Від оцінки залежить, коли картка повернеться.',
  },
  {
    n: '04',
    icon: <BookIcon />,
    title: 'База знань',
    to: '/kb',
    cta: 'Читати теорію',
    text: 'Теорія за тими самими темами з пошуком. У кожного розділу є «Тести з розділу» і Recall, щоб одразу перевірити прочитане.',
  },
];

const CASES: { title: string; when: string; steps: ReactNode[] }[] = [
  {
    title: 'Співбесіда через тиждень',
    when: 'Треба швидко підтягнути все, що спитають.',
    steps: [
      'Щодня закривай три завдання дня: вони тримають серію і дають бонусні XP.',
      <>
        У <Link to="/quiz">Тестах</Link> обирай теми з вакансії й рівень senior, по 20 питань.
      </>,
      'Після спроби проходь «Помилки й пропуски ще раз», а не весь тест знову.',
      'Увечері розкажи вголос слабкі розділи в Active Recall.',
    ],
  },
  {
    title: '15 хвилин на день',
    when: 'Підтримувати форму без великих сесій.',
    steps: [
      <>
        Відкрий <Link to="/recall/due">картки, яким пора</Link>: інтервальне повторення саме
        підкаже, що вже забувається.
      </>,
      'Виконай одне завдання дня, щоб не втратити серію.',
    ],
  },
  {
    title: 'Закрити прогалину в темі',
    when: 'Дашборд показує розділ як failing.',
    steps: [
      'На дашборді в «Слабких розділах» натисни «Теорія» і прочитай розділ.',
      'Там же запусти «Тести з розділу», щоб перевірити розуміння.',
      'Закріпи Recall по цьому розділу: оцінки 4–5 підіймуть його рівень.',
    ],
  },
  {
    title: 'Тренування code review',
    when: 'На співбесіді дадуть код і попросять знайти проблеми.',
    steps: [
      <>
        У <Link to="/quiz/pwfix">Тестах</Link> відкрий «Playwright: Code review» або «TypeScript:
        Code review»: питання у форматі «знайди помилку».
      </>,
      'Вони рахуються в рівень тем Playwright і TypeScript.',
    ],
  },
  {
    title: 'Інший пристрій або стара версія сайту',
    when: 'Прогрес має бути всюди однаковий.',
    steps: [
      <>
        <Link to="/register">Створи акаунт</Link> (email або Google): прогрес гостьового режиму
        перенесеться в нього.
      </>,
      <>
        Прогрес зі старої версії переноситься на сторінці{' '}
        <Link to="/import">«Перенести прогрес»</Link>. Старе збереження при цьому не змінюється.
      </>,
    ],
  },
];

export function Tutorial() {
  const levels = LEVEL_TITLES.map((l) => `${l.title} (${l.from})`).join(' → ');
  return (
    <div className="dash tutorial">
      <div className="runhead">
        <div>
          <p className="prompt">$ qa-hub --help</p>
          <h1>Як користуватися QA Interview Hub</h1>
          <p className="sub">
            Тести перевіряють, чи ти впізнаєш правильну відповідь. Active Recall перевіряє, чи можеш
            пояснити її сам. На співбесіді потрібне друге, тому рівень теми рахується з обох.
          </p>
        </div>
      </div>

      <section aria-labelledby="flow-h">
        <h2 id="flow-h">Флов</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li className="card step" key={s.n}>
              <div className="step-head">
                <span className="ibox">{s.icon}</span>
                <span className="mono step-n">{s.n}</span>
                <h3 className="step-t">{s.title}</h3>
              </div>
              <p>{s.text}</p>
              <Link className="btn sm" to={s.to}>
                {s.cta}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cases-h">
        <h2 id="cases-h">Юз кейси</h2>
        <div className="cases">
          {CASES.map((c) => (
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
          <h2 id="xp-h">Як рахується прогрес</h2>
          <div className="tw">
            <table>
              <tbody>
                <tr>
                  <td>Перша правильна відповідь</td>
                  <td className="mono">
                    +{XP_RULES.firstCorrect.junior} / +{XP_RULES.firstCorrect.middle} / +
                    {XP_RULES.firstCorrect.senior} XP
                  </td>
                </tr>
                <tr>
                  <td>Повторна правильна (раз на день)</td>
                  <td className="mono">+{XP_RULES.repeatCorrect} XP</td>
                </tr>
                <tr>
                  <td>Картка Recall, якій пора (оцінка 4–5)</td>
                  <td className="mono">
                    +{XP_RULES.recallDue} (+{XP_RULES.recallDueGood}) XP
                  </td>
                </tr>
                <tr>
                  <td>Перше прочитання статті</td>
                  <td className="mono">+{XP_RULES.articleFirstRead} XP</td>
                </tr>
                <tr>
                  <td>
                    Тест з {XP_RULES.quizBonusMinAnswered}+ питань на{' '}
                    {Math.round(XP_RULES.quizBonusMinRatio * 100)}%+
                  </td>
                  <td className="mono">+{XP_RULES.quizBonus} XP</td>
                </tr>
                <tr>
                  <td>Усі три завдання дня</td>
                  <td className="mono">+{XP_RULES.dailyAllDone} XP</td>
                </tr>
                <tr>
                  <td>Серія росте</td>
                  <td className="mono">
                    +{XP_RULES.streakPerDay} × днів (до {XP_RULES.streakCap})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="legend">
            <b>Рівні:</b> {levels}.
          </p>
        </section>

        <section className="card" aria-labelledby="rules-h">
          <h2 id="rules-h">Правила</h2>
          <ul className="rules">
            <li>
              <b>Рівень теми</b> = 50% тести (частка питань, де остання відповідь правильна) + 50%
              Recall (середня самооцінка, неоцінені картки = 0).
            </li>
            <li>
              <b>Нагороди теми:</b> <span className="badge bronze">Бронза</span> від 60%,{' '}
              <span className="badge silver">Срібло</span> від 75%,{' '}
              <span className="badge gold">Золото</span> від 90%.
            </li>
            <li>
              <b>Recall:</b> оцінка 1 повертає картку в цій же сесії, 2 через{' '}
              {RECALL_INTERVAL_DAYS[1]} день, 3 через {RECALL_INTERVAL_DAYS[2]} дні, 4 через
              тиждень, 5 через два тижні.
            </li>
            <li>
              <b>Завдання дня</b> оновлюються опівночі за твоїм часом. Одне виконане завдання
              зараховує день у серію.
            </li>
            <li>
              <b>Гостьовий режим</b> зберігає прогрес лише в цьому браузері. В акаунті він на
              сервері й доступний з будь-якого пристрою.
            </li>
            <li>
              <b>Клавіші:</b> у тестах <span className="kbd">1–4</span> відповідь,{' '}
              <span className="kbd">S</span> пропуск, <span className="kbd">Enter</span> далі; у
              Recall <span className="kbd">Пробіл</span> відповідь, <span className="kbd">1–5</span>{' '}
              оцінка.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
