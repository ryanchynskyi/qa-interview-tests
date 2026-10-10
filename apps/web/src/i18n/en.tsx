import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Messages } from './uk';

const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** English UI strings; same shape as `uk.tsx`. */
export const en: Messages = {
  locale: 'en-GB',
  common: {
    loading: 'Loading…',
    loadFailed: 'Could not load',
    retry: 'Try again',
    somethingWrong: 'Something went wrong',
    somethingWrongRetry: 'Something went wrong. Try again.',
    all: 'All',
    theory: 'Theory',
    start: 'Start',
    startN: (n) => `Start (${n})`,
    toDashboard: 'To the dashboard',
    toDashboardArrow: 'To the dashboard →',
    close: 'Close',
    save: 'Save',
    saved: 'Saved.',
    topic: 'Topic',
  },
  nav: {
    sections: 'Sections',
    dash: 'Dashboard',
    quiz: 'Quizzes',
    recall: 'Active Recall',
    recallShort: 'Recall',
    kb: 'Knowledge base',
    kbShort: 'Docs',
    tutorial: 'Tutorial',
    tutorialTitle: 'How to use it',
    homeLabel: 'QA Interview Hub: dashboard',
    profile: 'Profile',
    signOut: 'Sign out',
    signOutTitle: 'Sign out of your account',
    levelLabel: 'Level and XP: profile',
    total: 'total',
    streak: 'Streak: ',
    days: 'd',
    streakLongest: (n) => `Longest streak: ${s(n, 'day', 'days')}`,
    streakNone: 'No streak yet: complete a daily task',
    language: 'Language',
  },
  account: {
    guest: (login, register) => (
      <>
        Guest mode: progress is saved in this browser only. {login} or {register} to keep it on the
        server.
      </>
    ),
    login: 'Sign in',
    register: 'create an account',
    signedIn: (name, email) => (
      <>
        Hi, {name} · progress is saved to your account ({email}).
      </>
    ),
  },
  footer: {
    tagline: 'Quizzes, Active Recall and a knowledge base for Senior QA Automation interviews.',
    keys: 'Keys',
    keysQuiz: '1–4 answer · S or 0 skip · Enter next',
    keysRecall: 'Space show the answer · 1–5 rate',
    learn: 'Learn',
    account: 'Account',
    importProgress: 'Move progress',
    legacy: 'Old version of the site',
    privacy: 'Privacy',
  },
  error: {
    newVersionTitle: 'A new version is out',
    newVersionText:
      'This tab was still running the old version. Reload to get the new one: your progress is safe.',
    title: 'Something went wrong',
    text: 'The page did not open. Reload it or go back to the dashboard. Your progress is saved.',
    reload: 'Reload the page',
    toDashboard: 'To the dashboard',
  },
  dash: {
    title: 'QA Interview Preparation Hub',
    tests: 'Quizzes',
    passed: (n) => `${n} passed`,
    of: (n) => `of ${n}`,
    rated: (n) => `${n} rated`,
    suites: (n) => `Suites: ${n}`,
    recallDue: (n) => `Review in Recall (${n})`,
    startQuiz: 'Start a quiz',
    weakTitle: 'Weak chapters: review',
    failing: (n) => `${n} failing`,
    quizBits: (c, a) => `quizzes ${c}/${a}`,
    recallBits: (avg) => `recall ${avg} of 5`,
    showAll: (n) => `Show all (${n})`,
    collapse: 'Collapse',
    weakEmpty:
      'This list fills in once you take quizzes or rate Recall cards: it collects chapters below 70% accuracy (at least 2 quiz answers) or with low self-ratings.',
    topics: 'Topics',
    formula: 'Topic level = 50% quizzes + 50% Active Recall',
    colSpec: 'Spec',
    colQuiz: 'Quizzes',
    colRecall: 'Recall',
    colLevel: 'Level',
    untested: 'not tested',
    badgeTitle: 'Topic level award',
    badge: { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' },
    howTo: 'How it is scored',
    howToText:
      'Topic level = 50% quizzes + 50% Active Recall. Quizzes: the share of the topic’s questions whose last answer was right (unanswered count as 0). Recall: the average self-rating over all the topic’s cards, where 1 = 0%, 5 = 100%, unrated = 0. So 100% means every quiz question answered right and every card rated 5.',
    codeReviewNote: 'The code review trainers count towards Playwright and TypeScript.',
    untestedList: 'Not tested:',
  },
  today: {
    title: (done, total) => `Today: ${done} of ${total}`,
    reset: (t) => `resets in ${t}`,
    duration: (h, m) => (h ? `${h} h ${m} min` : `${m} min`),
    passed: (n) => `${n} passed`,
    running: (n) => `${n} running`,
    total: (n) => `Tasks: ${n} total`,
    streakKept: (n) => `${s(n, 'day', 'days')} in a row: today already counts.`,
    streakKeep: (n) =>
      `${s(n, 'day', 'days')} in a row: complete at least one task today to keep it.`,
    streakStart: 'Complete at least one task to start a streak.',
    allDone: 'All tasks done!',
    bonus: (xp) => `All three: +${xp} XP bonus.`,
  },
  tasks: {
    answerTopic: (n, topic) => `Answer ${s(n, 'question', 'questions')} on ${topic}`,
    answer: (n) => `Answer ${s(n, 'quiz question', 'quiz questions')}`,
    accuracy: (n, pct) => `Pass a quiz of ${n}+ questions at ${pct}%+`,
    review: (n) => (n === 1 ? 'Review 1 card that is due' : `Review ${n} cards that are due`),
    read: (chapter) => `Read an article from “${chapter}”`,
    codeReview: (n) => `Find the bug: ${s(n, 'correct answer', 'correct answers')}`,
    weakSpot: (chapter, n) =>
      `Work on the weak chapter “${chapter}”: ${s(n, 'answer or card', 'answers or cards')}`,
    daily: 'Daily task',
  },
  toasts: {
    taskDone: (name, xp) => `Task done: ${name} · +${xp} XP`,
    allDone: (xp) => `All of today’s tasks done! +${xp} XP`,
    streak: (n, xp) => `Streak: ${s(n, 'day', 'days')} in a row · +${xp} XP`,
    quizBonus: (xp) => `Accurate quiz bonus · +${xp} XP`,
    levelUp: (n, title) => `New level ${n}: ${title}!`,
  },
  quiz: {
    correctOf: (y, n) => `${y} of ${n} correct`,
    setup: (name) => `${name}: set up a run`,
    level: 'Level',
    topics: 'Topics',
    allTopics: 'All topics',
    count: 'Questions',
    weak: (n) => `Weak spots (${n})`,
    weakNote:
      'Weak spots: questions whose last answer was wrong or skipped. Every answer links to the knowledge base chapter with the theory.',
    lastAttempts: 'Recent runs:',
    attempt: (y, n) => `${y} of ${n}`,
    questionOf: (i, n) => `Question ${i} of ${n}`,
    finished: 'Finished',
    counts: (y, n, sk) => `Correct ${y} · Wrong ${n} · Skipped ${sk}`,
    checkFailed: (msg) => `Could not check the answer: ${msg}`,
    verdict: { y: 'Correct', n: 'Wrong', s: 'Skipped' },
    skip: 'Skip',
    stop: 'End the run',
    next: 'Next',
    resultHigh: 'Confident level. Lock it in with Active Recall: explain these topics out loud.',
    resultMid:
      'Middle level. Read the theory for topics below 70% in the table instead of retaking the whole quiz.',
    resultLow:
      'Weak for Senior. Go through the mistakes, read the chapters in the table and explain them out loud in Active Recall.',
    result: 'Result',
    bonus: (xp) => `+${xp} XP bonus`,
    failed: (n) => `${n} failed`,
    testsTotal: (n) => `Tests: ${n} total`,
    correctSummary: (y, n) => `${y} correct of ${n}.`,
    colTopic: 'Topic',
    colCorrect: 'Correct',
    redo: (n) => `Retry mistakes and skips (${n})`,
    again: 'New run',
    wipeConfirm: 'Sure? Click again',
    wipe: 'Clear this section’s progress',
  },
  recall: {
    rates: ['No idea', 'Weak', 'Partly', 'Good', 'Interview-ready'],
    scopeChapter: (title) => `Chapter: ${title}`,
    scopeDue: 'Cards due for review',
    scopeAll: 'All topics',
    intro:
      'Interview-style questions. Answer out loud first, as if to an interviewer, and only then open the model answer. Rate honestly: 3 means you got the gist but without an example or details. The rating feeds the dashboard and decides when the card comes back.',
    due: 'Due',
    cards: 'Cards',
    pool: (scope, due, fresh, later) =>
      `${scope}: ${due} due, ${fresh} new, ${later} scheduled. Order: due cards first (lowest rating first), then new ones, then the rest.`,
    progress: 'Progress by topic',
    colRated: 'Rated',
    colAvg: 'Average',
    colDue: 'Due',
    intervals: (d1, d2) =>
      `Intervals: 1 or lower comes back in the same session, 2 after ${s(d1, 'day', 'days')}, 3 after ${s(d2, 'day', 'days')}, 4 after a week, 5 after two weeks.`,
    rateFailed: (msg) => `Could not save the rating: ${msg}`,
    done: 'Session finished',
    avgOf: (n) => `Average self-rating over ${s(n, 'answer', 'answers')}.`,
    avgHigh: ' Good: you can talk about these topics in an interview.',
    avgMid:
      ' You know the gist but miss examples and details. Re-read the chapters below and review tomorrow.',
    avgLow:
      ' These are gaps an interviewer would spot right away. Start with the theory for the cards below.',
    colQuestion: 'Question',
    colRating: 'Rating',
    again: 'Another session',
    cardOf: (i, n) => `Card ${i} of ${n}`,
    lastRating: (r, n) => `Last rating ${r} · ${s(n, 'review', 'reviews')}`,
    newCard: 'New card',
    hint: 'Answer out loud for 1–2 minutes. Structure: definition, how it works, an example from practice, pitfalls.',
    reveal: 'Show the answer',
    finish: 'Finish',
    answer: 'Model answer',
    more: (title) => `More: ${title} →`,
    howWell: 'How well did you answer?',
  },
  kb: {
    sidebar: 'Knowledge base chapters',
    search: 'Search the whole knowledge base',
    searchLabel: 'Search',
    chapter: 'Chapter',
    pickChapter: 'Pick a chapter',
    title: 'Knowledge base',
    intro:
      'Theory for every topic: guides on Cypress, Manual QA and SQL, the “Knowledge Base: Manual/Auto QA (Middle)” notes, a Postman cheat sheet and new chapters on Playwright, TypeScript, System Design and patterns. Chapters match the quiz topics: every question links here.',
    topicStats: (chapters, articles) =>
      `${s(chapters, 'chapter', 'chapters')} · ${s(articles, 'article', 'articles')}`,
    found: (n) => `Found: ${n}`,
    nothing: 'Nothing found. Try another word.',
    articles: (n) => s(n, 'article', 'articles'),
    tests: (y, n) => `quizzes ${y}/${n}`,
    chapterTests: 'Chapter quiz',
    collapseAll: 'Collapse all',
    expandAll: 'Expand all',
  },
  xp: {
    lastDays: (n) => `XP over the last ${s(n, 'day', 'days')}:`,
    activeDays: 'active days:',
    chartLabel: (total) => `XP per day, ${total} in total`,
    asTable: 'Show as a table',
    day: 'Day',
  },
  profile: {
    guest: 'Guest',
    level: 'level',
    xpTotal: 'XP in total',
    streakNow: 'days in a row now',
    streakBest: 'longest streak',
    guestChart: (register) => (
      <>
        The guest chart is built from the last 100 events in this browser. {register} to keep
        progress on the server.
      </>
    ),
    createAccount: 'Create an account',
    nameAndZone: 'Name and time zone',
    name: 'Name',
    zone: 'Time zone: daily tasks reset at its midnight',
    zoneCooldown: 'The time zone can change once a day; next change after',
    zoneFromDevice: (zone) => `Use this device’s zone (${zone})`,
    passwordSaved: 'Password saved. Other devices were signed out.',
    wrongPassword: 'The current password is wrong.',
    changePassword: 'Change password',
    addPassword: 'Add a password',
    viaGoogle: 'You sign in with Google now. With a password you can also sign in by email.',
    currentPassword: 'Current password',
    newPassword: 'New password (at least 8 characters)',
    savePassword: 'Save password',
    methods: 'Sign-in methods',
    emailPassword: 'Email and password',
    on: 'on',
    noPassword: 'no password',
    connected: 'connected',
    notConnected: 'not connected',
    linkGoogle: (email) =>
      `To connect Google, sign out and sign in with Google using the same email (${email}).`,
    created: 'Account created',
    deleteTitle: 'Delete account',
    deleteText:
      'Deletes the account and all its progress on the server for good: answers, cards, XP, streak. This cannot be undone. Type your email to confirm.',
    deleteConfirmLabel: 'Email to confirm',
    deleting: 'Deleting…',
    deleteForever: 'Delete the account for good',
  },
  auth: {
    errors: {
      invalid_credentials: 'Wrong email or password.',
      email_taken: 'An account with this email already exists. Try signing in.',
      rate_limited: 'Too many attempts. Wait a minute.',
      google_cancelled: 'Google sign-in was cancelled.',
      google_state: 'The Google sign-in session expired. Try again.',
      google_email_unverified: 'Google has not verified this email, so it cannot be used.',
      google_disabled: 'Google sign-in is unavailable right now.',
      tz_cooldown: 'The time zone can only change once a day.',
      confirm_mismatch: 'The confirmation email does not match.',
    },
    googleFailed: 'Could not sign in with Google. Try again.',
    login: 'Sign in',
    register: 'Sign up',
    loginLead:
      'Sign in to keep your progress, level and daily tasks in your account, on every device.',
    registerLead:
      'An account keeps progress on the server: quizzes, Active Recall, XP, level and streak.',
    googleLogin: 'Sign in with Google',
    googleRegister: 'Sign up with Google',
    or: 'or email and password',
    name: 'Name (optional)',
    password: 'Password',
    passwordHint: ' (at least 8 characters)',
    wait: 'Wait…',
    submitLogin: 'Sign in',
    submitRegister: 'Create account',
    toRegister: 'No account? Sign up',
    toLogin: 'Already have an account? Sign in',
    after:
      'After you sign in, we offer to move progress from guest mode and the old version of the site into the account.',
    googleLoading: 'Signing in with Google…',
  },
  importer: {
    source: { guest: 'guest mode', legacy: 'old version of the site' },
    answers: (n) => s(n, 'answer', 'answers'),
    cards: (n) => s(n, 'Recall card', 'Recall cards'),
    articles: (n) => s(n, 'article read', 'articles read'),
    attempts: (n) => s(n, 'run', 'runs'),
    nothingNew: 'Nothing new: it is all here already.',
    done: (parts, xp, level) =>
      `Moved: ${parts}. +${xp} XP${level ? `, new level ${level}!` : '.'}`,
    failed: (msg) => `Could not move it: ${msg}`,
    bannerTitle: 'This browser has progress',
    bannerSource: (label, answers, cards) =>
      `${label} (${s(answers, 'answer', 'answers')}, ${s(cards, 'card', 'cards')})`,
    bannerAsk: (signedIn) =>
      `. Move it ${signedIn ? 'to your account' : 'here'}? XP is recalculated by the new site’s rules; what is already ${signedIn ? 'in the account' : 'here'} stays as it is.`,
    moving: 'Moving…',
    move: 'Move',
    later: 'Later',
    never: 'Don’t ask again',
    otherBrowser: (link: ReactNode) => (
      <>Progress from another browser can be moved with a {link}.</>
    ),
    backup: 'backup copy',
    emptyCopy: 'The copy is empty: it has no answers or ratings.',
    notJson: 'This does not look like copied progress: the text must start with { and end with }.',
    noData: 'The text has no progress data. Copy it with the “Скопіювати прогрес” button.',
    pageTitle: 'Move progress from the old version',
    pageLead: (target) =>
      `Open the old version of the site in the browser that has your progress, click “Скопіювати прогрес” (copy progress) and paste the text here. Progress goes ${target}. What is already there stays; XP is recalculated by the new site’s rules.`,
    toAccount: (email) => `to the account ${email}`,
    toBrowser: 'to this browser (guest mode)',
    pasted: 'Copied progress',
    inCopy: (answers, cards, attempts) =>
      `In the copy: ${s(answers, 'answer', 'answers')}, ${s(cards, 'Recall card', 'Recall cards')}, ${s(attempts, 'quiz run', 'quiz runs')}.`,
    check: 'Check',
  },
  store: {
    sessionExpired: 'Session expired: sign in again',
    contentLoading: 'Content is still loading, try again in a moment',
  },
  tutorial: {
    title: 'How to use QA Interview Hub',
    lead: 'Quizzes check whether you recognise the right answer. Active Recall checks whether you can explain it yourself. An interview needs the second, so a topic’s level counts both.',
    flow: 'Flow',
    steps: [
      {
        title: 'Dashboard',
        cta: 'Open the dashboard',
        text: 'The day starts here: three daily tasks, your streak, weak chapters and every topic’s level. The button at the top takes you where it helps most right now.',
      },
      {
        title: 'Quizzes',
        cta: 'Take a quiz',
        text: 'Pick a topic, level (junior / middle / senior), subtopics and how many questions. Every answer comes with an explanation and a link to the theory. “Weak spots” gathers questions whose last answer was wrong or skipped.',
      },
      {
        title: 'Active Recall',
        cta: 'Review cards',
        text: 'Interview questions. Answer out loud for 1–2 minutes first, then open the model answer and rate yourself honestly from 1 to 5. The rating decides when the card comes back.',
      },
      {
        title: 'Knowledge base',
        cta: 'Read the theory',
        text: 'Theory for the same topics, with search. Every chapter has a chapter quiz and Recall, so you can check what you just read.',
      },
    ],
    cases: 'Use cases',
    caseList: [
      {
        title: 'Interview in a week',
        when: 'You need to brush up on everything they may ask, fast.',
        steps: [
          'Close the three daily tasks every day: they keep the streak and give bonus XP.',
          <>
            In <Link to="/quiz">Quizzes</Link>, pick the topics from the job ad and the senior
            level, 20 questions each.
          </>,
          'After a run, use “Retry mistakes and skips” instead of retaking the whole quiz.',
          'In the evening, explain your weak chapters out loud in Active Recall.',
        ],
      },
      {
        title: '15 minutes a day',
        when: 'Staying in shape without long sessions.',
        steps: [
          <>
            Open the <Link to="/recall/due">cards that are due</Link>: spaced repetition shows what
            you are starting to forget.
          </>,
          'Complete one daily task so you keep the streak.',
        ],
      },
      {
        title: 'Close a gap in a topic',
        when: 'The dashboard shows a chapter as failing.',
        steps: [
          'In “Weak chapters” on the dashboard, click “Theory” and read the chapter.',
          'From there, run the chapter quiz to check your understanding.',
          'Lock it in with Recall for that chapter: ratings of 4–5 raise its level.',
        ],
      },
      {
        title: 'Code review practice',
        when: 'The interview hands you code and asks what is wrong with it.',
        steps: [
          <>
            In <Link to="/quiz/pwfix">Quizzes</Link>, open “Playwright: Code review” or “TypeScript:
            Code review”: find-the-bug questions.
          </>,
          'They count towards the Playwright and TypeScript topic levels.',
        ],
      },
      {
        title: 'Another device or the old site',
        when: 'Progress should be the same everywhere.',
        steps: [
          <>
            <Link to="/register">Create an account</Link> (email or Google): guest progress moves
            into it.
          </>,
          <>
            Progress from the old version moves on the <Link to="/import">“Move progress”</Link>{' '}
            page. The old save is left untouched.
          </>,
        ],
      },
    ],
    xpTitle: 'How progress is scored',
    xpFirst: 'First correct answer',
    xpRepeat: 'Correct again (once a day)',
    xpRecall: 'Recall card that is due (rated 4–5)',
    xpArticle: 'Reading an article the first time',
    xpQuiz: (n, pct) => `A quiz of ${n}+ questions at ${pct}%+`,
    xpDaily: 'All three daily tasks',
    xpStreak: 'Streak grows',
    xpStreakValue: (per, cap) => `+${per} × days (up to ${cap})`,
    levels: 'Levels:',
    rules: 'Rules',
    ruleLevel: (
      <>
        <b>Topic level</b> = 50% quizzes (share of questions whose last answer was right) + 50%
        Recall (average self-rating, unrated cards = 0).
      </>
    ),
    ruleBadges: 'Topic awards:',
    from: 'from',
    ruleRecall: (d1, d2) => (
      <>
        <b>Recall:</b> a rating of 1 brings the card back in the same session, 2 after{' '}
        {s(d1, 'day', 'days')}, 3 after {s(d2, 'day', 'days')}, 4 after a week, 5 after two weeks.
      </>
    ),
    ruleDaily: (
      <>
        <b>Daily tasks</b> reset at your local midnight. One completed task counts the day towards
        your streak.
      </>
    ),
    ruleGuest: (
      <>
        <b>Guest mode</b> keeps progress in this browser only. In an account it lives on the server
        and works from any device.
      </>
    ),
    keys: 'Keys:',
    keysQuiz: 'in quizzes',
    keysAnswer: 'answer',
    keysSkip: 'skip',
    keysNext: 'next',
    keysRecall: 'in Recall',
    keysSpace: 'Space',
    keysReveal: 'answer',
    keysRate: 'rate',
  },
};
