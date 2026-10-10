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
