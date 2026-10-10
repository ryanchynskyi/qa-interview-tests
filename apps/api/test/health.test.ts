import { afterEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app';

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App | undefined;
afterEach(async () => {
  await app?.close();
});

/** Minimal Prisma stand-in: only what the health route touches. */
function fakeDb({ up }: { up: boolean }) {
  const count = async () => 7;
  return {
    $queryRaw: async () => {
      if (!up) throw new Error('connection refused');
      return [{ '?column?': 1 }];
    },
    question: { count },
    recallCard: { count },
    article: { count },
  } as unknown as PrismaClient;
}

describe('GET /health', () => {
  it('returns 200 with content counts when the database is up', async () => {
    app = await buildApp({
      db: fakeDb({ up: true }),
      webOrigin: 'http://localhost:5173',
      jwtSecret: 'x'.repeat(32),
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      db: 'up',
      content: { questions: 7, recallCards: 7, articles: 7 },
    });
  });

  it('returns 503 when the database is down', async () => {
    app = await buildApp({
      db: fakeDb({ up: false }),
      webOrigin: 'http://localhost:5173',
      jwtSecret: 'x'.repeat(32),
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded', db: 'down' });
  });

  it('allows CORS from the web origin', async () => {
    app = await buildApp({
      db: fakeDb({ up: true }),
      webOrigin: 'http://localhost:5173',
      jwtSecret: 'x'.repeat(32),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
