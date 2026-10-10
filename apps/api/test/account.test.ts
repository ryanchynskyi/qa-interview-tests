import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccountInfo, XpDay } from '@qa-hub/shared';
import { loadContent } from '@qa-hub/content';
import { signAccessToken } from '../src/auth/tokens';
import {
  JWT_SECRET,
  makeApp,
  register,
  testClock,
  testDb,
  TEST_URL,
  type TestApp,
} from './helpers';

const sql = loadContent().questions.filter((q) => q.sectionId === 'sql');
const H = 3_600_000;

describe.skipIf(!TEST_URL)('account endpoints', () => {
  const clock = testClock('2026-10-10T07:00:00Z');
  let app: TestApp;
  beforeAll(async () => {
    app = await makeApp(clock.now);
  });
  afterAll(() => app.close());

  async function user(over: Record<string, unknown> = {}) {
    const r = await register(app, over);
    const headers = async () => ({
      authorization: `Bearer ${await signAccessToken(r.user.id, JWT_SECRET, clock.now())}`,
    });
    const call = async (
      method: 'GET' | 'POST' | 'DELETE',
      url: string,
      payload?: object,
      cookie?: string,
    ) =>
      app.inject({
        method,
        url,
        payload,
        headers: { ...(await headers()), ...(cookie ? { cookie } : {}) },
      });
    return { ...r, call };
  }
  const refresh = (cookie: string) =>
    app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } });

  it('describes the account', async () => {
    const u = await user();
    const info = (await u.call('GET', '/me/account')).json<AccountInfo>();
    expect(info).toMatchObject({
      id: u.user.id,
      email: u.email,
      hasPassword: true,
      providers: [],
      timeZoneLockedUntil: null,
    });
    expect(info.createdAt).toBeGreaterThan(0);
  });

  describe('password', () => {
    it('requires the current password to change it and signs out other sessions', async () => {
      const u = await user();
      const other = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: u.email, password: 'correct horse battery' },
      });
      const otherCookie = String(other.headers['set-cookie']).split(';')[0]!;

      const wrong = await u.call(
        'POST',
        '/me/password',
        { currentPassword: 'nope', newPassword: 'new password 123' },
        u.cookie,
      );
      expect(wrong.statusCode).toBe(401);

      const ok = await u.call(
        'POST',
        '/me/password',
        { currentPassword: 'correct horse battery', newPassword: 'new password 123' },
        u.cookie,
      );
      expect(ok.statusCode).toBe(204);
      expect((await refresh(otherCookie)).statusCode).toBe(401); // other device signed out
      expect((await refresh(u.cookie)).statusCode).toBe(200); // this one stays

      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: u.email, password: 'new password 123' },
      });
      expect(login.statusCode).toBe(200);
    });

    it('lets a passwordless (Google-only) account set its first password', async () => {
      const u = await user();
      await testDb().user.update({ where: { id: u.user.id }, data: { passwordHash: null } });
      expect((await u.call('GET', '/me/account')).json<AccountInfo>().hasPassword).toBe(false);
      expect(
        (await u.call('POST', '/me/password', { newPassword: 'first password!' })).statusCode,
      ).toBe(204);
      expect((await u.call('GET', '/me/account')).json<AccountInfo>().hasPassword).toBe(true);
    });

    it('validates the new password', async () => {
      const u = await user();
      const res = await u.call('POST', '/me/password', {
        currentPassword: 'correct horse battery',
        newPassword: 'short',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('XP history', () => {
    it('buckets XP by the user’s local day, zeros included', async () => {
      clock.set('2026-10-10T07:00:00Z'); // 10:00 in Kyiv
      const u = await user();
      const q = sql[0]!;
      await u.call('POST', '/quiz/check', { questionId: q.id, choice: q.correctIndex });
      clock.set('2026-10-10T21:30:00Z'); // 00:30 on the 11th in Kyiv, still the 10th in UTC
      const q2 = sql[1]!;
      await u.call('POST', '/quiz/check', { questionId: q2.id, choice: q2.correctIndex });

      const days = (await u.call('GET', '/me/xp-history?days=3')).json<XpDay[]>();
      expect(days.map((d) => d.date)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
      expect(days[0]!.xp).toBe(0);
      expect(days[1]!.xp).toBeGreaterThan(0);
      expect(days[2]!.xp).toBeGreaterThan(0);
      clock.set('2026-10-10T07:00:00Z');
    });

    it('caps the range at 90 days', async () => {
      const u = await user();
      expect((await u.call('GET', '/me/xp-history?days=500')).json<XpDay[]>()).toHaveLength(90);
    });
  });

  it('reports the time-zone lock after a change', async () => {
    const u = await user();
    await app.inject({
      method: 'PATCH',
      url: '/me',
      payload: { timeZone: 'Asia/Tokyo' },
      headers: {
        authorization: `Bearer ${await signAccessToken(u.user.id, JWT_SECRET, clock.now())}`,
      },
    });
    const info = (await u.call('GET', '/me/account')).json<AccountInfo>();
    expect(info.timeZoneLockedUntil).toBe(clock.now() + 24 * H);
  });

  describe('deletion', () => {
    it('needs the email typed exactly, then removes everything', async () => {
      const u = await user();
      const q = sql[2]!;
      await u.call('POST', '/quiz/check', { questionId: q.id, choice: q.correctIndex });

      expect(
        (await u.call('DELETE', '/me', { confirmEmail: 'someone@else.test' })).statusCode,
      ).toBe(400);
      const res = await u.call('DELETE', '/me', { confirmEmail: u.email.toUpperCase() }, u.cookie);
      expect(res.statusCode).toBe(204);
      expect(String(res.headers['set-cookie'])).toMatch(/qa_rt=;/);
      expect(await testDb().user.count({ where: { id: u.user.id } })).toBe(0);
      expect(await testDb().questionState.count({ where: { userId: u.user.id } })).toBe(0);
      expect(await testDb().xpEvent.count({ where: { userId: u.user.id } })).toBe(0);
      expect((await refresh(u.cookie)).statusCode).toBe(401);
    });
  });
});
