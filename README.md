# QA Interview Hub

Quizzes, Active Recall and a knowledge base for Senior QA Automation interviews.
The original single-page version lives in [`legacy/index.html`](legacy/index.html) and is still what
GitHub Pages serves from `main`; this branch rebuilds it as a full-stack app with accounts, levels
and daily tasks.

## Layout

| Path               | What                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `apps/api`         | Fastify + Prisma (PostgreSQL) backend                                |
| `apps/web`         | React + Vite frontend                                                |
| `packages/shared`  | Types, zod schemas and pure logic shared by frontend and backend     |
| `packages/content` | Quiz questions, KB articles and recall cards as JSON, plus extractor |
| `legacy/`          | The original single-file app (source for content extraction)         |

## Getting started

Requires Node 22+ (developed on 24). No Docker or Postgres install needed.

```bash
npm install
cp .env.example apps/api/.env

# terminal 1: local Postgres on :5433 (first run downloads binaries, then keeps running)
npm run db:start

# terminal 2: create tables, load content, start the API on :3000
npm run db:migrate
npm run db:seed
npm run dev:api

# terminal 3: web app on :5173
npm run dev:web
```

If you prefer Docker: `docker compose up -d db` instead of `npm run db:start`; same URL.

## Scripts

| Command                   | Does                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `npm run content:extract` | Regenerate `packages/content/data` from `legacy/index.html` |
| `npm test`                | Unit + API tests (Vitest)                                   |
| `npm run lint`            | ESLint                                                      |
| `npm run typecheck`       | TypeScript across all workspaces                            |
| `npm run build`           | Production build of the web app                             |

Question and card ids are FNV-1a hashes of their text, identical to the legacy app, so progress
exported from the old page can be imported later.

## API

| Endpoint                                                                  | Notes                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /health`                                                             | DB check + content counts                                                      |
| `GET /content/catalog`                                                    | Topics, sections, chapters and a question/card index (no text)                 |
| `GET /sections/:id/questions`                                             | Questions **without** the correct option or explanation                        |
| `POST /quiz/check`                                                        | `{questionId, choice}` → outcome, correct index, explanation                   |
| `GET /recall/cards`                                                       | Recall cards with model answers                                                |
| `GET /kb/chapters/:id`                                                    | Chapter with article HTML                                                      |
| `GET /kb/search?q=`                                                       | All words must match; title hits rank first                                    |
| `POST /auth/register`, `/auth/login`                                      | Email + password (argon2id); returns an access token, sets the refresh cookie  |
| `POST /auth/refresh`, `/auth/logout`                                      | Rotating refresh token in an httpOnly cookie; reuse revokes the session family |
| `GET /auth/google`, `/auth/google/callback`                               | Google sign-in (PKCE); the callback hands the app a one-time code              |
| `POST /auth/google/exchange`                                              | One-time code → session, sets the refresh cookie                               |
| `GET /auth/me`, `PATCH /me`                                               | Profile; time zone changeable once a day                                       |
| `GET /me/progress`                                                        | Everything the UI needs; creates today's tasks on a new local day              |
| `POST /me/quiz/finish`                                                    | Records a run; correctness comes from stored answers                           |
| `POST /me/recall/rate`, `/me/articles/:id/read`, `/me/sections/:id/reset` | Progress mutations                                                             |

Answers are checked on the server, so the correct option never ships with a question.

## Accounts, progress and guest mode

Without an account, progress lives in `localStorage` (`qa-hub-guest-v1`). Signed-in users keep it on
the server. Both run the same engine in `packages/shared/src/engine` (XP, levels, streaks, three
daily tasks that reset at local midnight), so the rules are identical.

Sessions: a 15-minute access token (JWT, kept in memory) plus a 30-day refresh token in an
httpOnly, SameSite=Lax cookie (`SameSite=None; Secure; Partitioned` with `COOKIE_SAMESITE=none`, when
the web app is on another site; writes from other origins are then refused). Refresh tokens are stored hashed and rotated on every use; replaying
an old one ends the whole session family. Register/login are rate limited (10/min per IP). Server
progress writes lock the user's row, so parallel requests can't double-count XP.

`JWT_SECRET` (32+ chars) is required; see `.env.example`.

### Google sign-in (optional)

Authorization-code flow with PKCE, handled by the API; the browser never sees Google's tokens.
Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` in `apps/api/.env`
(create a "Web application" client under Google Auth Platform → Clients; for local dev the redirect
URI is `http://localhost:5173/api/auth/google/callback`). Without them the button is hidden.

The callback sets no session cookie: it redirects to `#/auth/google?code=…` with a one-time,
two-minute code, which the app trades for a session with `POST /auth/google/exchange`. That way
the refresh cookie is always set by a fetch, in the same (possibly partitioned) cookie jar as later
refreshes, which matters when the API is on another site.

A Google account signs into the user with the same verified email. If that user registered with a
password but never verified the email, the password and its sessions are dropped on linking, since
whoever set them may not own the address.

## Moving progress in (guest mode, old site)

After sign-in the app offers to move progress found in this browser into the account: guest-mode
progress, and the old single-page site's save (`qa-hub-v1`, readable when both are served from the same
origin, e.g. GitHub Pages). From another browser, paste the old site's "Скопіювати прогрес" text on
`#/import`. Guests can import an old-site save into guest mode the same way.

`POST /me/import` accepts a normalised payload (built in the browser by `fromLegacy` / `fromGuest` in
`packages/shared/src/import.ts`, which understands every legacy save version). The server keeps what the
account already has, skips unknown content, clamps timestamps, and recalculates XP with the normal rules
once per newly added item, so importing twice adds nothing and nobody can import XP directly. The old
site's save is never modified; moved guest progress is kept as a backup under `qa-hub-guest-v1.imported`.

## Languages (Ukrainian / English)

Ukrainian is the default; a UA/EN switch in the top bar changes the UI and the content (the choice
is kept in `localStorage` and sets `<html lang>`).

- UI strings: `apps/web/src/i18n/{uk,en}.tsx`, same shape, read with `useT()`.
- Content: Ukrainian is the source in `packages/content/data/*.json`. English is an overlay,
  `packages/content/data/en/*.json`, keyed by the same ids (ids are hashes of the Ukrainian text and
  must not change). Question options keep the same order and count, because the correct index is
  checked on the server. Missing English falls back to Ukrainian per field.
- API: the content endpoints and `POST /quiz/check` take `?lang=en` (default `uk`); knowledge base
  search runs over the English text for `lang=en`.
- `npm run content:check-en` prints coverage and reports unknown ids, mismatched option lists and
  lost code blocks. The English text is machine-written and has not been reviewed by a native speaker.

## Tests

`npm test` runs unit tests everywhere plus API integration tests against a real, seeded database.
They use `TEST_DATABASE_URL` (`qahub_test`), which the test setup creates, migrates and seeds; tests
create their own users. Without the variable they are skipped. CI runs them against a Postgres service.

`npm run e2e` runs Playwright end-to-end tests (`e2e/`) against a fresh build of the web app and
a dedicated API (`apps/api/scripts/e2e-server.ts`: own `qahub_e2e` database, Google replaced by a
test-only consent screen). First time: `npx playwright install chromium`.

## Deploying

The web app stays on GitHub Pages (`ryanchynskyi.github.io`, the same origin as the old site, so its
save can be imported automatically). The API runs on Render's free plan with Neon's free Postgres;
`render.yaml` describes the service.

1. Neon: create a project (region near Frankfurt) and copy the **direct** connection string
   (with `?sslmode=require`).
2. Render: New → Blueprint → this repository. Fill in `DATABASE_URL`; the build migrates and seeds.
   `GET https://<service>.onrender.com/health` should report the content counts.
3. Google (optional): add `https://<service>.onrender.com/auth/google/callback` as a redirect URI,
   set the three `GOOGLE_*` variables on Render, then publish the OAuth app.
4. Build the web app with `VITE_API_URL=https://<service>.onrender.com`.

Free-plan caveats: the API sleeps after 15 idle minutes and the next request takes about a minute
(the app shows its loading state meanwhile). Cross-site cookies need the `Partitioned` attribute;
browsers that block third-party cookies without supporting it (older Safari) keep the session only
until the tab reloads.
