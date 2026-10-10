import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { AuthResponse } from '@qa-hub/shared';
import { buildApp } from '../src/app';

export const TEST_URL = process.env.TEST_DATABASE_URL;
export const JWT_SECRET = 'test-secret-that-is-long-enough-1234567890';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

/** A controllable clock; starts at a fixed instant (10:00 in Kyiv). */
export function testClock(iso = '2026-10-10T07:00:00Z') {
  let t = Date.parse(iso);
  return {
    now: () => t,
    set: (iso2: string) => void (t = Date.parse(iso2)),
    advance: (ms: number) => void (t += ms),
  };
}

let shared: PrismaClient | undefined;
export const testDb = () =>
  (shared ??= new PrismaClient({ datasources: { db: { url: TEST_URL } } }));

export function makeApp(now: () => number = Date.now, authRateLimit = 10_000) {
  return buildApp({
    db: testDb(),
    webOrigin: 'http://localhost:5173',
    jwtSecret: JWT_SECRET,
    now,
    authRateLimit,
  });
}

export const uniqueEmail = () => `t-${randomUUID().slice(0, 8)}@example.test`;

/** The `qa_rt=...` pair from a response, ready for a Cookie header. */
export function refreshCookie(res: { headers: Record<string, unknown> }): string | undefined {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const c = list.find((s: string) => s.startsWith('qa_rt='));
  return c?.split(';')[0];
}

export async function register(app: TestApp, over: Record<string, unknown> = {}) {
  const email = uniqueEmail();
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'correct horse battery', timeZone: 'Europe/Kyiv', ...over },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const body = res.json<AuthResponse>();
  return {
    email,
    ...body,
    cookie: refreshCookie(res)!,
    auth: { authorization: `Bearer ${body.accessToken}` },
  };
}
