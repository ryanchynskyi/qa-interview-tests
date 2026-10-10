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
httpOnly, SameSite=Lax cookie. Refresh tokens are stored hashed and rotated on every use; replaying
an old one ends the whole session family. Register/login are rate limited (10/min per IP). Server
progress writes lock the user's row, so parallel requests can't double-count XP.

`JWT_SECRET` (32+ chars) is required; see `.env.example`.

## Tests

`npm test` runs unit tests everywhere plus API integration tests against a real, seeded database.
They use `TEST_DATABASE_URL` (`qahub_test`), which the test setup creates, migrates and seeds; tests
create their own users. Without the variable they are skipped. CI runs them against a Postgres service.
