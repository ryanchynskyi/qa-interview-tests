import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Ukrainian UI strings: the source language. `en.tsx` has the same shape. */
export const uk = {
  locale: 'uk-UA',
  common: {
    loading: 'Завантаження…',
    loadFailed: 'Не вдалося завантажити',
    retry: 'Спробувати ще раз',
    somethingWrong: 'Щось пішло не так',
    somethingWrongRetry: 'Щось пішло не так. Спробуй ще раз.',
    all: 'Усі',
    theory: 'Теорія',
    start: 'Почати',
    startN: (n: number) => `Почати (${n})`,
    toDashboard: 'До дашборду',
    toDashboardArrow: 'До дашборду →',
    close: 'Закрити',
    save: 'Зберегти',
    saved: 'Збережено.',
    topic: 'Тема',
  },
  nav: {
    sections: 'Розділи',
    dash: 'Дашборд',
    quiz: 'Тести',
    recall: 'Active Recall',
    recallShort: 'Recall',
    kb: 'База знань',
    kbShort: 'База',
    tutorial: 'Tutorial',
    tutorialTitle: 'Як користуватися',
    homeLabel: 'QA Interview Hub: дашборд',
    profile: 'Профіль',
    signOut: 'Вийти',
    signOutTitle: 'Вийти з акаунта',
    levelLabel: 'Рівень і XP: профіль',
    total: 'усього',
    streak: 'Серія: ',
    days: 'дн.',
    streakLongest: (n: number) => `Найдовша серія: ${n} дн.`,
    streakNone: 'Серії поки немає: виконай завдання дня',
    language: 'Мова',
  },
  account: {
    guest: (login: ReactNode, register: ReactNode) => (
      <>
        Гостьовий режим: прогрес зберігається лише в цьому браузері. {login} або {register}, щоб
        зберігати прогрес на сервері.
      </>
    ),
    login: 'Увійти',
    register: 'створити акаунт',
    signedIn: (name: ReactNode, email: string) => (
      <>
        Привіт, {name} · прогрес зберігається в акаунті ({email}).
      </>
    ),
  },
  footer: {
    tagline: 'Тести, Active Recall і база знань для співбесіди Senior QA Automation.',
    keys: 'Клавіші',
    keysQuiz: '1–4 відповідь · S або 0 пропуск · Enter далі',
    keysRecall: 'Пробіл показати відповідь · 1–5 оцінка',
    learn: 'Навчання',
    account: 'Акаунт',
    importProgress: 'Перенести прогрес',
    legacy: 'Стара версія сайту',
    privacy: 'Конфіденційність',
  },
  error: {
    newVersionTitle: 'Вийшла нова версія сайту',
    newVersionText:
      'Ця вкладка ще працювала зі старою версією. Онови сторінку, щоб завантажити нову: прогрес нікуди не дівся.',
    title: 'Щось пішло не так',
    text: 'Сторінка не відкрилась. Спробуй оновити її або повернутись на дашборд. Прогрес збережено.',
    reload: 'Оновити сторінку',
    toDashboard: 'На дашборд',
  },
  dash: {
    title: 'QA Interview Preparation Hub',
    tests: 'Тести',
    passed: (n: number) => `${n} passed`,
    of: (n: number) => `з ${n}`,
    rated: (n: number) => `${n} оцінено`,
    suites: (n: number) => `Suites: ${n}`,
    recallDue: (n: number) => `Повторити в Recall (${n})`,
    startQuiz: 'Почати тест',
    weakTitle: 'Слабкі теми: повторити',
    failing: (n: number) => `${n} failing`,
    quizBits: (c: number, a: number) => `тести ${c}/${a}`,
    recallBits: (avg: string) => `recall ${avg} з 5`,
    showAll: (n: number) => `Показати всі (${n})`,
    collapse: 'Згорнути',
    weakEmpty:
      'Список зʼявиться, коли пройдеш тести або оціниш картки Recall: сюди потрапляють розділи з точністю нижче 70% (мінімум 2 відповіді в тестах) або з низькою самооцінкою.',
    topics: 'Теми',
    formula: 'Рівень теми = 50% тести + 50% Active Recall',
    colSpec: 'Spec',
    colQuiz: 'Тести',
    colRecall: 'Recall',
    colLevel: 'Рівень',
    untested: 'не перевірено',
    badgeTitle: 'Нагорода за рівень теми',
    badge: { gold: 'Золото', silver: 'Срібло', bronze: 'Бронза' },
    howTo: 'Як рахується',
    howToText:
      'Рівень теми = 50% тести + 50% Active Recall. Тести: частка питань теми, на які остання відповідь правильна (не пройдені рахуються як 0). Recall: середня самооцінка по всіх картках теми, де 1 = 0%, 5 = 100%, неоцінені = 0. Тобто 100% означає: усі тести пройдені правильно і всі картки оцінені на 5.',
    codeReviewNote: 'Code review тренажери входять у Playwright і TypeScript.',
    untestedList: 'Не перевірено:',
  },
  today: {
    title: (done: number, total: number) => `Сьогодні: ${done} з ${total}`,
    reset: (t: string) => `reset через ${t}`,
    duration: (h: number, m: number) => (h ? `${h} год ${m} хв` : `${m} хв`),
    passed: (n: number) => `${n} passed`,
    running: (n: number) => `${n} running`,
    total: (n: number) => `Tasks: ${n} total`,
    streakKept: (n: number) => `Серія ${n} дн. поспіль: сьогодні вже зараховано.`,
    streakKeep: (n: number) =>
      `Серія ${n} дн. поспіль: виконай хоча б одне завдання сьогодні, щоб її не втратити.`,
    streakStart: 'Виконай хоча б одне завдання, щоб почати серію днів.',
    allDone: 'Усі завдання виконано!',
    bonus: (xp: number) => `За всі три: ще +${xp} XP бонусом.`,
  },
  tasks: {
    answerTopic: (n: number, topic: string) => `Дай відповідь на ${n} питань з теми ${topic}`,
    answer: (n: number) => `Дай відповідь на ${n} питань у тестах`,
    accuracy: (n: number, pct: number) => `Пройди тест із ${n}+ питань на ${pct}%+`,
    review: (n: number) => `Повтори ${n} карток, яким пора`,
    read: (chapter: string) => `Прочитай статтю з розділу «${chapter}»`,
    codeReview: (n: number) => `Знайди помилку в коді: ${n} правильні відповіді`,
    weakSpot: (chapter: string, n: number) =>
      `Підтягни слабкий розділ «${chapter}»: ${n} відповідей або карток`,
    daily: 'Завдання дня',
  },
  toasts: {
    taskDone: (name: string, xp: number) => `Завдання виконано: ${name} · +${xp} XP`,
    allDone: (xp: number) => `Усі завдання на сьогодні виконано! +${xp} XP`,
    streak: (n: number, xp: number) => `Серія: ${n} дн. поспіль · +${xp} XP`,
    quizBonus: (xp: number) => `Бонус за точний тест · +${xp} XP`,
    levelUp: (n: number, title: string) => `Новий рівень ${n}: ${title}!`,
  },
  quiz: {
    correctOf: (y: number, n: number) => `${y} з ${n} правильно`,
    setup: (name: string) => `${name}: налаштування спроби`,
    level: 'Рівень',
    topics: 'Теми',
    allTopics: 'Усі теми',
    count: 'Питань',
    weak: (n: number) => `Слабкі місця (${n})`,
    weakNote:
      'Слабкі місця: питання, на які остання відповідь була неправильна або пропущена. Після кожної відповіді є посилання на розділ Knowledge Base з теорією.',
    lastAttempts: 'Останні спроби:',
    attempt: (y: number, n: number) => `${y} з ${n}`,
    questionOf: (i: number, n: number) => `Питання ${i} з ${n}`,
    finished: 'Завершено',
    counts: (y: number, n: number, s: number) => `Правильно ${y} · Помилки ${n} · Пропущено ${s}`,
    checkFailed: (msg: string) => `Не вдалося перевірити відповідь: ${msg}`,
    verdict: { y: 'Правильно', n: 'Неправильно', s: 'Пропущено' },
    skip: 'Пропустити',
    stop: 'Завершити спробу',
    next: 'Далі',
    resultHigh: 'Впевнений рівень. Закріпи в Active Recall: розкажи ці теми вголос.',
    resultMid:
      'Середній рівень. Відкрий теорію для тем з таблиці нижче 70%, а не проходь весь тест знову.',
    resultLow:
      'Слабко для Senior. Пройди помилки, прочитай розділи з таблиці і поясни їх вголос в Active Recall.',
    result: 'Результат',
    bonus: (xp: number) => `+${xp} XP бонус`,
    failed: (n: number) => `${n} failed`,
    testsTotal: (n: number) => `Tests: ${n} total`,
    correctSummary: (y: number, n: number) => `${y} правильних з ${n}.`,
    colTopic: 'Тема',
    colCorrect: 'Правильно',
    redo: (n: number) => `Пройти помилки й пропуски ще раз (${n})`,
    again: 'Нова спроба',
    wipeConfirm: 'Точно? Натисни ще раз',
    wipe: 'Очистити прогрес цієї секції',
  },
  recall: {
    rates: ['Не знаю', 'Слабко', 'Частково', 'Добре', 'Як на співбесіді'],
    scopeChapter: (title: string) => `Розділ: ${title}`,
    scopeDue: 'Картки, які пора повторити',
    scopeAll: 'Усі теми',
    intro:
      'Питання в стилі співбесіди. Спершу відповідай вголос, як інтервʼюеру, і тільки потім відкривай еталон. Оцінюй чесно: 3 означає, що ти сказав суть, але без прикладу чи деталей. Оцінка впливає на дашборд і на те, коли картка повернеться.',
    due: 'Пора повторити',
    cards: 'Карток',
    pool: (scope: string, due: number, fresh: number, later: number) =>
      `${scope}: до повторення ${due}, нових ${fresh}, відкладених ${later}. Порядок: спершу ті, що пора повторити (з найнижчою оцінкою), потім нові, потім решта.`,
    progress: 'Прогрес по темах',
    colRated: 'Оцінено',
    colAvg: 'Середнє',
    colDue: 'Пора',
    intervals: (d1: number, d2: number) =>
      `Інтервали: 1 і нижче повертається в цій же сесії, 2 через ${d1} день, 3 через ${d2} дні, 4 через тиждень, 5 через два тижні.`,
    rateFailed: (msg: string) => `Не вдалося зберегти оцінку: ${msg}`,
    done: 'Сесія завершена',
    avgOf: (n: number) => `Середня самооцінка за ${n} відповідей.`,
    avgHigh: ' Добре: ці теми можна розповідати на співбесіді.',
    avgMid:
      ' Суть знаєш, але бракує прикладів і деталей. Перечитай розділи нижче і повтори завтра.',
    avgLow:
      ' Це прогалини, які на співбесіді будуть видні одразу. Почни з теорії по картках нижче.',
    colQuestion: 'Питання',
    colRating: 'Оцінка',
    again: 'Ще сесія',
    cardOf: (i: number, n: number) => `Картка ${i} з ${n}`,
    lastRating: (r: number, n: number) => `Остання оцінка ${r} · повторів ${n}`,
    newCard: 'Нова картка',
    hint: 'Відповідай вголос 1–2 хвилини. Структура: визначення, як це працює, приклад з практики, підводні камені.',
    reveal: 'Показати відповідь',
    finish: 'Завершити',
    answer: 'Еталонна відповідь',
    more: (title: string) => `Детальніше: ${title} →`,
    howWell: 'Наскільки добре ти відповів?',
  },
  kb: {
    sidebar: 'Розділи бази знань',
    search: 'Пошук по всій базі знань',
    searchLabel: 'Пошук',
    chapter: 'Розділ',
    pickChapter: 'Оберіть розділ',
    title: 'База знань',
    intro:
      'Теорія по всіх темах: гайди Cypress, Manual QA і SQL, конспект «Knowledge Base: Manual/Auto QA (Middle)», шпаргалка Postman і нові розділи з Playwright, TypeScript, System Design і патернів. Розділи відповідають темам тестів: з кожного питання є посилання сюди.',
    topicStats: (chapters: number, articles: number) => `${chapters} розділів · ${articles} статей`,
    found: (n: number) => `Знайдено: ${n}`,
    nothing: 'Нічого не знайдено. Спробуй інше слово або англійський термін.',
    articles: (n: number) => `${n} статей`,
    tests: (y: number, n: number) => `тести ${y}/${n}`,
    chapterTests: 'Тести з розділу',
    collapseAll: 'Згорнути всі',
    expandAll: 'Розгорнути всі',
  },
  xp: {
    lastDays: (n: number) => `XP за останні ${n} днів:`,
    activeDays: 'активних днів:',
    chartLabel: (total: number) => `XP по днях, усього ${total}`,
    asTable: 'Показати таблицею',
    day: 'День',
  },
  profile: {
    guest: 'Гість',
    level: 'рівень',
    xpTotal: 'XP усього',
    streakNow: 'днів поспіль зараз',
    streakBest: 'найдовша серія',
    guestChart: (register: ReactNode) => (
      <>
        Графік гостя будується з останніх 100 подій у цьому браузері. {register}, щоб зберігати
        прогрес на сервері.
      </>
    ),
    createAccount: 'Створи акаунт',
    nameAndZone: 'Імʼя та часовий пояс',
    name: 'Імʼя',
    zone: 'Часовий пояс: щоденні завдання оновлюються опівночі за ним',
    zoneCooldown: 'Часовий пояс можна змінювати раз на добу; наступна зміна після',
    zoneFromDevice: (zone: string) => `Взяти з цього пристрою (${zone})`,
    passwordSaved: 'Пароль збережено. Інші пристрої вийшли з акаунта.',
    wrongPassword: 'Поточний пароль невірний.',
    changePassword: 'Змінити пароль',
    addPassword: 'Додати пароль',
    viaGoogle: 'Зараз ти входиш через Google. З паролем можна входити ще й за email.',
    currentPassword: 'Поточний пароль',
    newPassword: 'Новий пароль (щонайменше 8 символів)',
    savePassword: 'Зберегти пароль',
    methods: 'Способи входу',
    emailPassword: 'Email і пароль',
    on: 'увімкнено',
    noPassword: 'немає пароля',
    connected: 'підключено',
    notConnected: 'не підключено',
    linkGoogle: (email: string) =>
      `Щоб підключити Google, вийди й увійди через Google з тим самим email (${email}).`,
    created: 'Акаунт створено',
    deleteTitle: 'Видалити акаунт',
    deleteText:
      'Назавжди видаляє акаунт і весь прогрес на сервері: відповіді, картки, XP, серію. Скасувати не можна. Щоб підтвердити, введи свій email.',
    deleteConfirmLabel: 'Email для підтвердження',
    deleting: 'Видаляю…',
    deleteForever: 'Видалити акаунт назавжди',
  },
  auth: {
    errors: {
      invalid_credentials: 'Невірний email або пароль.',
      email_taken: 'Акаунт з таким email вже існує. Спробуй увійти.',
      rate_limited: 'Забагато спроб. Зачекай хвилину.',
      google_cancelled: 'Вхід через Google скасовано.',
      google_state: 'Сесія входу через Google застаріла. Спробуй ще раз.',
      google_email_unverified: 'Google не підтвердив цей email, тож увійти з ним не можна.',
      google_disabled: 'Вхід через Google зараз недоступний.',
      tz_cooldown: 'Часовий пояс можна змінювати раз на добу.',
      confirm_mismatch: 'Email для підтвердження не збігається.',
    } as Record<string, string>,
    googleFailed: 'Не вдалося увійти через Google. Спробуй ще раз.',
    login: 'Вхід',
    register: 'Реєстрація',
    loginLead:
      'Увійди, щоб прогрес, рівень і щоденні завдання зберігалися в акаунті й були доступні на всіх пристроях.',
    registerLead:
      'Акаунт зберігає прогрес на сервері: тести, Active Recall, XP, рівень і серію днів.',
    googleLogin: 'Увійти через Google',
    googleRegister: 'Зареєструватися через Google',
    or: 'або email і пароль',
    name: 'Імʼя (необовʼязково)',
    password: 'Пароль',
    passwordHint: ' (щонайменше 8 символів)',
    wait: 'Зачекай…',
    submitLogin: 'Увійти',
    submitRegister: 'Створити акаунт',
    toRegister: 'Немає акаунта? Зареєструватися',
    toLogin: 'Вже є акаунт? Увійти',
    after:
      'Після входу ми запропонуємо перенести прогрес гостьового режиму та старої версії сайту в акаунт.',
    googleLoading: 'Входимо через Google…',
  },
  importer: {
    source: { guest: 'гостьовий режим', legacy: 'стара версія сайту' },
    answers: (n: number) => `${n} відповідей`,
    cards: (n: number) => `${n} карток Recall`,
    articles: (n: number) => `${n} прочитаних статей`,
    attempts: (n: number) => `${n} спроб`,
    nothingNew: 'Нового нічого: усе це вже є.',
    done: (parts: string, xp: number, level: number | null) =>
      `Перенесено: ${parts}. +${xp} XP${level ? `, новий рівень ${level}!` : '.'}`,
    failed: (msg: string) => `Не вдалося перенести: ${msg}`,
    bannerTitle: 'У цьому браузері є прогрес',
    bannerSource: (label: string, answers: number, cards: number) =>
      `${label} (${answers} відповідей, ${cards} карток)`,
    bannerAsk: (signedIn: boolean) =>
      `. Перенести ${signedIn ? 'в акаунт' : 'сюди'}? XP перерахується за правилами нового сайту; те, що вже є ${signedIn ? 'в акаунті' : 'тут'}, не зміниться.`,
    moving: 'Переношу…',
    move: 'Перенести',
    later: 'Пізніше',
    never: 'Не пропонувати',
    otherBrowser: (link: ReactNode) => <>Прогрес з іншого браузера можна перенести через {link}.</>,
    backup: 'резервну копію',
    emptyCopy: 'Копія порожня: у ній немає відповідей чи оцінок.',
    notJson: 'Це не схоже на скопійований прогрес: текст має починатися з { і закінчуватися }.',
    noData: 'У тексті немає даних прогресу. Скопіюй його кнопкою «Скопіювати прогрес».',
    pageTitle: 'Перенести прогрес зі старої версії',
    pageLead: (target: string) =>
      `Відкрий стару версію сайту в браузері, де є твій прогрес, натисни «Скопіювати прогрес» і встав текст сюди. Прогрес піде ${target}. Те, що вже є, не зміниться; XP перерахується за правилами нового сайту.`,
    toAccount: (email: string) => `в акаунт ${email}`,
    toBrowser: 'в цей браузер (гостьовий режим)',
    pasted: 'Скопійований прогрес',
    inCopy: (answers: number, cards: number, attempts: number) =>
      `У копії: ${answers} відповідей, ${cards} карток Recall, ${attempts} спроб тестів.`,
    check: 'Перевірити',
  },
  store: {
    sessionExpired: 'Сесія закінчилась: увійди ще раз',
    contentLoading: 'Зміст ще завантажується, спробуй за мить',
  },
  tutorial: {
    title: 'Як користуватися QA Interview Hub',
    lead: 'Тести перевіряють, чи ти впізнаєш правильну відповідь. Active Recall перевіряє, чи можеш пояснити її сам. На співбесіді потрібне друге, тому рівень теми рахується з обох.',
    flow: 'Флов',
    steps: [
      {
        title: 'Дашборд',
        cta: 'Відкрити дашборд',
        text: 'Звідси починається день: три завдання дня, серія, слабкі розділи й рівень кожної теми. Кнопка вгорі веде туди, де зараз найбільше користі.',
      },
      {
        title: 'Тести',
        cta: 'Пройти тест',
        text: 'Обери тему, рівень (junior / middle / senior), підтеми й кількість питань. Після кожної відповіді є пояснення і посилання на теорію. «Слабкі місця» збирають питання, де остання відповідь була неправильна або пропущена.',
      },
      {
        title: 'Active Recall',
        cta: 'Повторити картки',
        text: 'Питання як на співбесіді. Спершу відповідай вголос 1–2 хвилини, потім відкрий еталон і чесно оціни себе від 1 до 5. Від оцінки залежить, коли картка повернеться.',
      },
      {
        title: 'База знань',
        cta: 'Читати теорію',
        text: 'Теорія за тими самими темами з пошуком. У кожного розділу є «Тести з розділу» і Recall, щоб одразу перевірити прочитане.',
      },
    ],
    cases: 'Юз кейси',
    caseList: [
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
            У <Link to="/quiz/pwfix">Тестах</Link> відкрий «Playwright: Code review» або
            «TypeScript: Code review»: питання у форматі «знайди помилку».
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
    ] as { title: string; when: string; steps: ReactNode[] }[],
    xpTitle: 'Як рахується прогрес',
    xpFirst: 'Перша правильна відповідь',
    xpRepeat: 'Повторна правильна (раз на день)',
    xpRecall: 'Картка Recall, якій пора (оцінка 4–5)',
    xpArticle: 'Перше прочитання статті',
    xpQuiz: (n: number, pct: number) => `Тест з ${n}+ питань на ${pct}%+`,
    xpDaily: 'Усі три завдання дня',
    xpStreak: 'Серія росте',
    xpStreakValue: (per: number, cap: number) => `+${per} × днів (до ${cap})`,
    levels: 'Рівні:',
    rules: 'Правила',
    ruleLevel: (
      <>
        <b>Рівень теми</b> = 50% тести (частка питань, де остання відповідь правильна) + 50% Recall
        (середня самооцінка, неоцінені картки = 0).
      </>
    ),
    ruleBadges: 'Нагороди теми:',
    from: 'від',
    ruleRecall: (d1: number, d2: number) => (
      <>
        <b>Recall:</b> оцінка 1 повертає картку в цій же сесії, 2 через {d1} день, 3 через {d2} дні,
        4 через тиждень, 5 через два тижні.
      </>
    ),
    ruleDaily: (
      <>
        <b>Завдання дня</b> оновлюються опівночі за твоїм часом. Одне виконане завдання зараховує
        день у серію.
      </>
    ),
    ruleGuest: (
      <>
        <b>Гостьовий режим</b> зберігає прогрес лише в цьому браузері. В акаунті він на сервері й
        доступний з будь-якого пристрою.
      </>
    ),
    keys: 'Клавіші:',
    keysQuiz: 'у тестах',
    keysAnswer: 'відповідь',
    keysSkip: 'пропуск',
    keysNext: 'далі',
    keysRecall: 'у Recall',
    keysSpace: 'Пробіл',
    keysReveal: 'відповідь',
    keysRate: 'оцінка',
  },
};

export type Messages = typeof uk;
