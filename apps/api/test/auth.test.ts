import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthResponse, AuthUser } from '@qa-hub/shared';
import { signAccessToken } from '../src/auth/tokens';
import {
  JWT_SECRET,
  makeApp,
  refreshCookie,
  register,
  testClock,
  TEST_URL,
  uniqueEmail,
  type TestApp,
} from './helpers';

describe.skipIf(!TEST_URL)('auth', () => {
  const clock = testClock();
  let app: TestApp;
  beforeAll(async () => {
    app = await makeApp(clock.now);
  });
  afterAll(() => app.close());

  const post = (url: string, payload?: object, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url, payload, headers });
  const refresh = (cookie: string) => post('/auth/refresh', undefined, { cookie });
  const me = (token: string) =>
    app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${token}` } });

  describe('register', () => {
    it('creates an account, returns an access token and sets an httpOnly refresh cookie', async () => {
      const email = uniqueEmail();
      const res = await post('/auth/register', {
        email: `  ${email.toUpperCase()} `,
        password: 'correct horse battery',
        timeZone: 'Europe/Kyiv',
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<AuthResponse>();
      expect(body.user).toMatchObject({
        email,
        timeZone: 'Europe/Kyiv',
        displayName: email.split('@')[0],
      });
      expect(body.accessToken.split('.')).toHaveLength(3);

      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/^qa_rt=[\w-]{40,};/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
    });

    it('stores only a hash of the password', async () => {
      const r = await register(app);
      const user = await app.db.user.findUniqueOrThrow({ where: { id: r.user.id } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain('correct horse');
    });

    it('rejects duplicates, weak passwords and bad emails', async () => {
      const r = await register(app);
      const dup = await post('/auth/register', {
        email: r.email,
        password: 'another password',
        timeZone: 'UTC',
      });
      expect(dup.statusCode).toBe(409);
      expect(dup.json()).toMatchObject({ error: 'email_taken' });
      expect(
        (await post('/auth/register', { email: uniqueEmail(), password: 'short', timeZone: 'UTC' }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await post('/auth/register', {
            email: 'nope',
            password: 'long enough pw',
            timeZone: 'UTC',
          })
        ).statusCode,
      ).toBe(400);
    });

    it('falls back to UTC for an unknown time zone', async () => {
      const r = await register(app, { timeZone: 'Mars/Base' });
      expect(r.user.timeZone).toBe('UTC');
    });
  });

  describe('login', () => {
    it('accepts the right password (email is case-insensitive)', async () => {
      const r = await register(app);
      const res = await post('/auth/login', {
        email: r.email.toUpperCase(),
        password: 'correct horse battery',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<AuthResponse>().user.id).toBe(r.user.id);
      expect(refreshCookie(res)).toBeDefined();
    });

    it('gives the same generic error for a wrong password and an unknown email', async () => {
      const r = await register(app);
      const wrong = await post('/auth/login', { email: r.email, password: 'wrong password' });
      const unknown = await post('/auth/login', { email: uniqueEmail(), password: 'whatever pw' });
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json()).toEqual(unknown.json());
    });
  });

  describe('access tokens', () => {
    it('authorises /auth/me', async () => {
      const r = await register(app);
      const res = await me(r.accessToken);
      expect(res.statusCode).toBe(200);
      expect(res.json<AuthUser>()).toEqual(r.user);
    });

    it('rejects missing, forged and expired tokens', async () => {
      expect((await app.inject({ method: 'GET', url: '/auth/me' })).statusCode).toBe(401);
      const forged = await signAccessToken(
        'someone',
        'a-different-secret-that-is-long-enough',
        clock.now(),
      );
      expect((await me(forged)).statusCode).toBe(401);
      const r = await register(app);
      const expired = await signAccessToken(r.user.id, JWT_SECRET, clock.now() - 16 * 60_000);
      expect((await me(expired)).statusCode).toBe(401);
    });
  });

  describe('refresh', () => {
    it('rotates: a new cookie and token each time', async () => {
      const r = await register(app);
      const first = await refresh(r.cookie);
      expect(first.statusCode).toBe(200);
      const next = refreshCookie(first)!;
      expect(next).not.toBe(r.cookie);
      expect((await me(first.json<AuthResponse>().accessToken)).statusCode).toBe(200);
      expect((await refresh(next)).statusCode).toBe(200);
    });

    it('treats reuse of a rotated token as theft and ends the whole session family', async () => {
      const r = await register(app);
      const rotated = refreshCookie(await refresh(r.cookie))!;
      clock.advance(60_000); // well past the multi-tab grace period
      const replay = await refresh(r.cookie);
      expect(replay.statusCode).toBe(401);
      // The legitimate holder's newer token is revoked too.
      expect((await refresh(rotated)).statusCode).toBe(401);
    });

    it('tolerates a near-simultaneous refresh from a second tab', async () => {
      const r = await register(app);
      const rotated = refreshCookie(await refresh(r.cookie))!;
      expect((await refresh(r.cookie)).statusCode).toBe(401); // the slower tab loses...
      expect((await refresh(rotated)).statusCode).toBe(200); // ...but the session survives
    });

    it('expires after 30 days', async () => {
      const r = await register(app);
      clock.advance(31 * 86_400_000);
      expect((await refresh(r.cookie)).statusCode).toBe(401);
    });

    it('needs a cookie', async () => {
      expect((await post('/auth/refresh')).statusCode).toBe(401);
      expect((await refresh('qa_rt=not-a-real-token')).statusCode).toBe(401);
    });
  });

  describe('rate limiting', () => {
    it('allows 10 login attempts per minute per IP by default', async () => {
      const limited = await makeApp(clock.now, 10);
      try {
        const codes: number[] = [];
        for (let i = 0; i < 11; i++) {
          const res = await limited.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email: uniqueEmail(), password: 'whatever pw' },
          });
          codes.push(res.statusCode);
        }
        expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
        expect(codes[10]).toBe(429);
      } finally {
        await limited.close();
      }
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const r = await register(app);
      const res = await post('/auth/logout', undefined, { cookie: r.cookie });
      expect(res.statusCode).toBe(204);
      expect(String(res.headers['set-cookie'])).toMatch(/qa_rt=;/);
      expect((await refresh(r.cookie)).statusCode).toBe(401);
    });
  });

  describe('PATCH /me', () => {
    const patch = (token: string, payload: object) =>
      app.inject({
        method: 'PATCH',
        url: '/me',
        payload,
        headers: { authorization: `Bearer ${token}` },
      });

    it('updates the name and allows one time-zone change per day', async () => {
      const r = await register(app);
      expect((await patch(r.accessToken, { displayName: 'Rostyk' })).json()).toMatchObject({
        displayName: 'Rostyk',
      });
      expect((await patch(r.accessToken, { timeZone: 'Asia/Tokyo' })).json()).toMatchObject({
        timeZone: 'Asia/Tokyo',
      });
      const again = await patch(r.accessToken, { timeZone: 'Europe/Kyiv' });
      expect(again.statusCode).toBe(429);
      expect(again.json()).toMatchObject({ error: 'tz_cooldown' });
      clock.advance(25 * 3_600_000);
      // A fresh token: the old one expired while the clock moved.
      const fresh = await signAccessToken(r.user.id, JWT_SECRET, clock.now());
      expect((await patch(fresh, { timeZone: 'Europe/Kyiv' })).statusCode).toBe(200);
      expect((await patch(fresh, { timeZone: 'Not/AZone' })).statusCode).toBe(400);
    });
  });
});
