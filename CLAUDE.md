# QA Interview Hub — notes for Claude

Full-stack rebuild of a single-file quiz/recall/knowledge-base site for Senior QA Automation
interviews. UI text is **Ukrainian**; code, comments and docs are English. See `README.md` for the
user-facing overview and API table.

## Git rules (important)

- **`main` is production.** Every push to `main` deploys: the Pages workflow publishes the web app
  to https://ryanchynskyi.github.io/qa-interview-tests/ (old site at `/legacy/`), and Render
  redeploys the API (https://qa-hub-api.onrender.com) from `main`. Never push to `main` directly.
- All work happens on **`develop`** (was `fullstack`; M1–M8 are there). It reaches `main` only through
  a pull request `develop → main`, merged with "Create a merge commit". After a merge, merge `main`
  back into `develop` so the merge commits don't pile up as differences.
- History: M1 was merged (PR #1), reverted (`cd08947`), and the revert reverted again in PR #3
  (M1–M8 release). Nothing special is needed any more.
- Commit as **`ryanchynskyi <ryanchynskyi98@gmail.com>`** (set as repo-local git config; the machine's
  global identity belongs to another GitHub account). End commit messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commit/push only when the user asks. `gh` CLI is not installed: open PRs via a prefilled
  `https://github.com/ryanchynskyi/qa-interview-tests/compare/main...<branch>?quick_pull=1&title=…&body=…` link.

## Layout

| Path               | What                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `apps/api`         | Fastify 5 + Prisma 6 (PostgreSQL). `src/app.ts` builds the app (DI: db, clock, google) |
| `apps/web`         | React 19 + Vite 8, hash routes (keeps legacy URLs like `#/quiz/sql`)                   |
| `packages/shared`  | Types, zod schemas, the game **engine** (`src/engine`), import logic                   |
| `packages/content` | Extracted content JSON (`data/`) + extractor from `legacy/index.html`                  |
| `legacy/`          | The original app; source of content. Do not edit                                       |

npm workspaces (pnpm needs admin rights on this machine). Node 24, Windows 11, Git Bash/PowerShell.

## Running locally (Windows specifics)

```bash
npm install                     # first time; then: cp .env.example apps/api/.env and fill it
npm run db:start                # embedded Postgres on :5433, keep running (Ctrl+C stops it)
npm run db:migrate && npm run db:seed
```

Start servers as **single node processes** so stopping them actually stops them (`npm run dev:*`
spawns children that survive a killed parent on Windows and keep ports/files locked):

```bash
cd apps/api && node --env-file=.env --import tsx src/server.ts      # API on 127.0.0.1:3000
cd apps/web && node ../../node_modules/vite/bin/vite.js             # web on :5173 (strictPort), /api proxied
```

- **Stop the API before `npm install` or `prisma migrate`**: a running API locks Prisma's query
  engine DLL and `prisma generate` fails with EPERM. Find leftovers with `netstat -ano | grep :3000`.
- npm 11 `allowScripts` in root `package.json` pins approved install scripts (prisma, @prisma/*,
  esbuild, embedded-postgres) **by version**; after upgrading them run `npm install-scripts approve <pkg>`.
- The embedded cluster is created with `--encoding=UTF8 --locale=C` (a Cyrillic Windows locale gave
  WIN1251). Because of the C locale, Postgres `lower()`/`ILIKE` only fold ASCII: search uses a
  JS-lowercased `Article.search` column.
- `npm audit` shows `deepmerge-ts` via Prisma's CLI config loader (dev-only); an override broke
  Prisma's install, so it is left for a Prisma upgrade.
- `apps/api/.env` (git-ignored) holds `JWT_SECRET`, `GOOGLE_*`, `TEST_DATABASE_URL` and a local
  test account (`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`). Never print secrets.

## Checks

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

API integration tests need `TEST_DATABASE_URL` (`qahub_test`); `apps/api/test/global-setup.ts`
creates, migrates and seeds it. Tests create users with unique emails, inject a clock
(`testClock()`), and raise the auth rate limit via `makeApp()`. CI (`.github/workflows/ci.yml`) runs
the same with a Postgres service, then the e2e tests. Verify UI changes in the browser, not only with tests.

End-to-end: `npm run e2e` (Playwright, Chromium; first time `npx playwright install chromium`).
`playwright.config.ts` starts `apps/api/scripts/e2e-server.ts` on :3100 (own `qahub_e2e` database,
derived from `TEST_DATABASE_URL`, prepared on start; Google replaced by a test-only consent screen)
and `vite preview` of a fresh build on :4173, so it runs alongside the dev servers. Locally it reuses
servers that are already up: stop them after changing API code.

## Architecture

- **One engine, two stores.** `packages/shared/src/engine` is pure and clock-injected: XP rules
  (`xp.ts`), levels, per-item progress (`items.ts`), skill/weak chapters (legacy formulas), daily
  tasks (seeded per user+local date), streaks and `recordActivity`. The web's `GuestStore`
  (localStorage `qa-hub-guest-v1`) and the API's `ProgressService` both call it, so rules can't drift.
  The web talks to either through `ProgressRepo` (`apps/web/src/progress/types.ts`); `ServerStore`
  patches a local snapshot from each mutation's `ProgressUpdate`.
- **Time zones.** Daily tasks reset at the user's local midnight (`localDate`, Intl only, DST-safe).
  `ensureDaily` never moves to an earlier date, and the time zone may change once a day, so switching
  zones can't farm task sets.
- **Content ids** are FNV-1a hashes of the text, identical to the legacy app — keep them stable, or
  old saves can't be imported. Options are reshuffled at extraction (seeded by question id) because
  legacy data always had the right answer first.

## Security invariants (keep them)

- Correct answers never ship with questions; `POST /quiz/check` decides, and records progress when
  authenticated. XP is always computed server-side for signed-in users; the client never sends XP.
- `POST /me/quiz/finish` counts correctness from stored answers (6-hour run window, no duplicates).
- Every progress write runs in a transaction that locks the user row (`SELECT … FOR UPDATE`).
- Use explicit timestamps from the injected clock for logic (`QuestionState.answeredAt`), never
  Prisma `@updatedAt` (wall clock, breaks time-travel tests).
- Sessions: 15-min HS256 access token in memory; 30-day refresh token in an httpOnly SameSite=Lax
  cookie (None+Partitioned in cross-site mode, with an Origin check on non-GET requests), stored hashed, rotated on use; reuse after a 30 s grace revokes the family. Only a 401 from
  `/auth/refresh` signs the client out (network errors don't). Login/register/import rate limited.
- Google: code flow + PKCE on the server, state in a 10-min httpOnly cookie, claims checked
  (iss/aud/exp/email_verified), open-redirect guard on `next`. Linking a verified Google email to an
  account whose email was never verified drops that account's password and sessions.
- Import (`POST /me/import`): known content only, existing data wins, timestamps clamped, XP
  recomputed once per new item; idempotent. The legacy `qa-hub-v1` save is never modified.

## Code conventions

- Prettier (single quotes, 100 cols). ESLint includes React Compiler rules: no `Date.now()` in render
  (use `useNow()`), no mutating props or module variables in components (use `createStore()` from
  `apps/web/src/lib/stores.ts`), no synchronous setState in effects.
- Server errors: throw `HttpError(status, code, message)`; zod errors become 400 automatically.
- When generating code through shell heredocs/template strings, watch regex escapes (`\d` was lost
  once and silently broke article import).

## Status and what's left (M8)

Done: M1 monorepo + content, M2 engine, M3 content API + guest mode, M4 email/password + server
progress, M5 Google sign-in, M6 progress import, M7 daily-task card, streaks, toasts, badges,
profile page. M8 done: e2e, bundle split, hosting, Google sign-in live in production.

M8 — tests and deployment:

1. ~~Playwright e2e tests, wired into CI~~ (done: `e2e/`).
2. ~~Bundle split~~ (done: lazy route views; zod schemas live in `*.schema.ts` and `@qa-hub/shared` is
   `sideEffects: false`, so the web bundle has no zod. Keep schemas out of the runtime modules).
3. ~~Hosting~~ (live since PR #3): API on Render free (`render.yaml`), Postgres on Neon free (Frankfurt),
   web on GitHub Pages. Cookie strategy decided: cross-site mode
   (`COOKIE_SAMESITE=none` → `SameSite=None; Secure; Partitioned`, Origin check on writes); Google
   callback hands the app a one-time code redeemed by fetch (`POST /auth/google/exchange`) so the
   refresh cookie lands in the partitioned jar. Rate limits key on `CLIENT_IP_HEADER=true-client-ip`:
   on Render, X-Forwarded-For keeps client-supplied entries plus Cloudflare and internal hops, so
   `TRUST_PROXY=1` saw rotating Cloudflare IPs and limits never triggered. Steps: README "Deploying".
4. ~~Google~~ (published "In production"; Render `GOOGLE_REDIRECT_URI` must be the onrender.com
   callback, not the localhost one from `apps/api/.env`). Privacy policy: `apps/web/public/privacy.html`;
   update it when the app starts storing new kinds of data.
5. ~~Pages via Actions, revert the revert, merge into `main`~~ (done in PR #3; legacy at `/legacy/`).

## M9 — "Test Runner" redesign (done on `develop`, not merged yet)

Direction A from the design canvas (https://claude.ai/artifact/QDQZngEZ7kn7WticxJnju9): dark, IDE-like,
daily tasks read as a test-run report (PASS / RUN), topics as `*.spec` rows, weak chapters as failing.
Tokens: bg `#0F1115`, surface `#171A21`, line `#262B35`, fg `#E6E8EC`, muted `#A9B1BF`, accent amber
`#F5C451`, ok `#4ADE80`, bad `#FF8A5C`, warn `#FFB86B`, info `#7CC4FF`; JetBrains Mono for labels and
numbers, IBM Plex Sans for text. Dark only. Mobile first: 16px gutters, touch targets ≥44px, inputs
16px (no iOS zoom), bottom tab bar under 720px. Keep e2e selectors (test ids, `.opt`, `.verdict`,
`.xpgain`, `details.art`, and the copy the specs assert). The streak pill reads "Серія: N дн.".

Milestones, ordered so each step reskins as much as possible for the effort:

1. ~~Tokens + base components~~ (done: `styles/base.css`, was `legacy.css`) (`styles/`): new palette and fonts, restyle the shared classes (`.btn`,
   `.card`, `.chip`, `.opt`, `.tab`, `pre`, tables, forms, toasts). The whole app changes at once.
2. ~~App shell~~ (`Layout.tsx`): top bar with logo, nav, level/XP, streak, profile; compact guest/account
   line; bottom tab bar on mobile.
3. ~~Dashboard~~: run header + "continue" CTA, Today card as a run report, failing chapters, topic
   `*.spec` table that turns into cards on mobile.
4. ~~Quiz~~: section picker, question card, options with PASS/FAIL marks, progress, results as a report;
   sticky action bar on mobile.
5. ~~Recall + Knowledge Base~~: card and rating buttons; KB sidebar → select on mobile, article styling.
6. ~~Profile, Auth, Import~~, XP chart, toasts; final pass at 360/390/768/1280 px, contrast, e2e green.
