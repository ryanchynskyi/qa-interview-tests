# Handoff: English localization (M10)

Status on 2026-10-10, branch `develop`. Lint, format, typecheck, 219 unit/integration tests, build
and 8/8 e2e pass. Nothing of M10 is pushed or merged yet.

## Goal

The app gets a second language. Ukrainian (UA) stays the default and the source of all content;
English (EN) is chosen by the user. Two layers are translated:

1. **UI**: every label, button, message, toast, error, the tutorial page, dates and plurals.
2. **Content**: topic, section, chapter and group names; 704 quiz questions (text, options,
   explanation, Ukrainian strings inside code); 166 Active Recall cards (question, answer);
   442 knowledge base articles (title, HTML).

Not translated: the legacy app (`legacy/`), the privacy page (`apps/web/public/privacy.html`, still
UA only), server error messages (the client maps known error codes instead).

## Key decisions and why

- **Language choice.** A UA/EN switch (`LangSwitch` in `apps/web/src/Layout.tsx`): top bar on
  desktop, footer on every screen (the phone top bar has no room). Saved in localStorage
  `qa-hub-lang`; default is always `uk`, never guessed from the browser, because the audience is
  Ukrainian and the user asked to keep UA as is. `<html lang>` follows the choice.
- **UI strings** live in `apps/web/src/i18n/uk.tsx` and `en.tsx`, one object per language with the
  same shape (`Messages`; TypeScript and `i18n.test.ts` enforce it). Components read them with
  `useT()`. Values are strings, functions (for numbers and plurals) or JSX (texts with links). No
  library: about 400 strings did not justify one, and the bundle stays small. Code outside
  components (`describeTask`, `activityMessages`, `summarize`, `parseLegacyBackup`) takes the
  messages object as an optional argument that defaults to the current language
  (`getMessages()`), so their existing tests kept working.
- **Content translations are an overlay, not a copy.** `packages/content/data/en/*.json` hold only
  the translated fields, keyed by the Ukrainian ids. Those ids are FNV-1a hashes of the Ukrainian
  text and old saves depend on them, so they never change. Any missing field falls back to
  Ukrainian, so a partial translation is always a working state.
- **Answer options are translated index for index.** The correct answer is checked server-side by
  index (`correctIndex`), so the English option list must have the same length and order. The API
  ignores an option list of another length instead of shifting answers.
- **The server does the substitution, not the database.** No migration: the API loads the overlay
  once at start (`buildApp({ translations })`, default `loadTranslation('en')` from
  `@qa-hub/content`) and applies it per request (`translateCatalog/Question/Card/Chapter/
Explanation` in `packages/shared/src/translation.ts`). Content endpoints take `?lang=en`;
  `POST /quiz/check` takes `lang` in the body for the explanation. An unknown `lang` means `uk`.
  The translated catalog is memoised per language like the Ukrainian one.
- **English KB search** runs in memory over the English text (442 articles; index built once per
  process, untranslated articles keep Ukrainian text). Ukrainian search still uses the database
  `search` column. Both share the same ranking (`apps/api/src/routes/kb.ts`).
- **The client** (`apps/web/src/api.ts`, `hooks/content.ts`) passes the language to every content
  request and includes it in every React Query key, so switching language fetches the other
  version once and switching back is instant. `checkAnswer` adds the current language itself.
- **Validation.** `translationIssues()` (shared) reports unknown ids, unknown groups, option lists
  of another length, a code block added or lost, and a different number of inline `` `code` ``
  spans or `<pre>` blocks. `npm run content:check-en` prints coverage and problems;
  `packages/content/test/translation.test.ts` fails the build on any problem.

## Done

UI (milestone 1):

- `apps/web/src/i18n/{index.ts,uk.tsx,en.tsx,i18n.test.ts}`: store, `useT`, `useLang`, `setLang`,
  `getLang`, `getMessages`, `plural()`, both dictionaries, shape test.
- Every view and helper moved to the dictionaries: `Layout.tsx` (+ `LangSwitch`), `RouteError.tsx`,
  `lib/{ui,tasks,toasts}.tsx?`, `progress/{guest-store,server-store,import-sources}.ts`,
  `views/*` (Dashboard, TodayCard, Quiz, Recall, KnowledgeBase, Profile, AuthPage, ImportBanner,
  ImportPage, Tutorial, XpChart). `lib/ui.tsx` has `errorText(e, t)` for API errors.
- Styles for the switch and a fix for the KB landing page (it used classes removed in the
  redesign): `apps/web/src/styles/app.css`.

Content plumbing (milestone 2):

- `packages/shared/src/translation.ts` (types, `translate*`, `translationIssues`,
  `translationCoverage`), `translation.schema.ts` (zod: overlay files, `langQuerySchema`),
  `api.schema.ts` (`lang` in `checkAnswerSchema`).
- `packages/content/src/index.ts`: `loadTranslation('en')`, `TRANSLATION_FILES`.
- `packages/content/scripts/check-translation.ts` and the root script `content:check-en`.
- API: `apps/api/src/app.ts` (`translation(lang)`, `catalogIn(lang)`, `translations` dep),
  `routes/content.ts`, `routes/quiz.ts`, `routes/kb.ts`.
- Web: `apps/web/src/api.ts`, `apps/web/src/hooks/content.ts`.
- Tests: `packages/shared/test/translation.test.ts`, `apps/api/test/translation.test.ts`
  (database-backed, injects its own small overlay), `packages/content/test/translation.test.ts`.

Translations (milestone 3, DONE, 100% by `npm run content:check-en`, no problems):

- `packages/content/data/en/`: `topics`, `sections`, `chapters`, `groups` (names), `questions.json`
  (704/704), `recall-cards.json` (166/166), `articles.json` (442/442).
- All of it is machine-written by Claude and unreviewed by a native speaker.
- Source-data defect: articles `cy-8:0` and `cy-8:1` lost the `$` in GitHub Actions expressions
  (`DOLLAR{{ ... }}` in the Ukrainian source); the English overlay uses `${{ ... }}`.

## What is left, step by step

1. **Milestone 4 is done** except review: `e2e/english.spec.ts` (switch, quiz, recall card, KB
   search in English), language note in `privacy.html`, README "Languages" section, `<html lang>`
   follows the language. Left: have a native speaker review the English copy and content.
2. After changing overlays: `npm run content:check-en` (must report no problems) and restart the
   API to see it in the app (overlays load at start).
3. Commit, push `develop`, open the PR `develop → main` (no `gh`: use the prefilled compare link
   from CLAUDE.md), merge with "Create a merge commit", then merge `main` back into `develop`.

A practical workflow that worked: print a batch of source entries (id, text, options, explanation)
with a small Node script, write the English JSON for that batch with the file tools, merge it into
the overlay file in source order, run the check. The helper scripts were throwaway and are not in
the repo; they are easy to rewrite from `packages/content/data/*.json`.

## Known issues and pitfalls

- **Restart the API after changing overlays or API code.** Translations, the translated catalog and
  the English search index are built once per process. The dev API started before this work is
  still running the old code on :3000: stop it and start it again (see CLAUDE.md) before checking
  EN content in the browser. e2e starts its own API on :3100 and is not affected.
- **Option order is load-bearing.** Never reorder or drop options in a translation; the API then
  falls back to Ukrainian options for that question, and the check reports it.
- **e2e asserts Ukrainian copy** (`Гостьовий режим`, `Серія: 0 дн.`, `Сьогодні: 0 з 3`, import
  messages, auth errors). `uk.tsx` deliberately keeps the old wording, including `1 карток`-style
  plurals; change it only together with the specs.
- **Server errors are Ukrainian.** In EN the client shows mapped messages for known codes
  (`t.auth.errors`) and a generic line for other Cyrillic messages (`errorText` in `lib/ui.tsx`).
  New API error codes need an entry in both dictionaries.
- **Messages created at event time stay in that language**: a toast or the import result text
  shown before switching does not re-translate. Acceptable, but don't build on it.
- **Git Bash eats backticks and `${…}`** in heredocs and `node -e` scripts (it silently produced
  broken code several times). Write code and JSON with the file tools.
- **Unit test runs sometimes failed before starting** ("25 failed, no tests") when run right after
  other commands in one long chain; the same suite passed on every separate run. Cause not found.
  If it happens, rerun `npm test` on its own and read the full log before assuming a real failure.
- The topic **names** "Playwright", "Cypress" etc. are the same in both languages; only "Патерни"
  becomes "Patterns". `kind` of articles is no longer shown (only the level), so it is not
  translated.

## How to check that it works

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npm run e2e
npm run content:check-en          # coverage per kind; must end without "problem(s)"
```

With the API restarted:

```bash
curl -s "http://127.0.0.1:3000/content/catalog?lang=en" | head -c 300      # "Patterns", English chapter titles
curl -s "http://127.0.0.1:3000/sections/playwright/questions?lang=en" | head -c 400
curl -s -X POST http://127.0.0.1:3000/quiz/check -H 'content-type: application/json' \
  -d '{"questionId":"n4h8c0","choice":1,"lang":"en"}'                     # English explanation
```

In the browser (http://localhost:5173): click EN in the top bar or footer. Expect the whole UI in
English, English topic and chapter names, translated Playwright questions with English
explanations after answering, Ukrainian fallback for not yet translated content, and the choice
kept after a reload. Click UA: everything is back to Ukrainian, unchanged from before M10.
