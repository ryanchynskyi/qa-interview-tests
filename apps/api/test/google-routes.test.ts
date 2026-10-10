import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthResponse } from '@qa-hub/shared';
import { buildApp } from '../src/app';
import type { GoogleIdentity, GoogleOAuth } from '../src/auth/google';
import { hashToken } from '../src/auth/tokens';
import { JWT_SECRET, refreshCookie, register, testDb, TEST_URL, uniqueEmail } from './helpers';

/** The app route the callback lands on: `#/auth/google?code=…&next=…`. */
function landing(cb: { headers: Record<string, unknown> }) {
  const hash = new URL(String(cb.headers.location)).hash;
  const [path, query = ''] = hash.slice(1).split('?');
  const p = new URLSearchParams(query);
  return { path, loginCode: p.get('code'), next: p.get('next') };
}

/** Stands in for Google: the "code" names the identity to return. */
function fakeGoogle(identities: Map<string, GoogleIdentity>): GoogleOAuth {
  return {
    authorizationUrl: (state, challenge) =>
      `https://accounts.google.test/auth?state=${state}&code_challenge=${challenge}`,
    exchangeCode: async (code) => {
      const id = identities.get(code);
      if (!id) throw new Error('unknown code');
      return id;
    },
  };
}

describe.skipIf(!TEST_URL)('Google sign-in routes', () => {
  const identities = new Map<string, GoogleIdentity>();
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp({
      db: testDb(),
      webOrigin: 'http://localhost:5173',
      webAppUrl: 'http://localhost:5173/',
      jwtSecret: JWT_SECRET,
      authRateLimit: 10_000,
      google: fakeGoogle(identities),
    });
  });
  afterAll(() => app.close());

  /** Runs /auth/google then the callback, like a browser bouncing through Google. */
  async function signIn(identity: Partial<GoogleIdentity> & { email: string }, next = '/dash') {
    const code = randomUUID();
    identities.set(code, { sub: randomUUID(), emailVerified: true, name: 'G User', ...identity });
    const start = await app.inject({
      method: 'GET',
      url: `/auth/google?next=${encodeURIComponent(next)}&tz=Europe/Kyiv`,
    });
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const oauthCookie = String(start.headers['set-cookie']).split(';')[0]!;
    const cb = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=${code}&state=${state}`,
      headers: { cookie: oauthCookie },
    });
    const { loginCode } = landing(cb);
    const ex = loginCode ? await exchange(loginCode) : undefined;
    return { start, cb, ex, loginCode, state, oauthCookie, code };
  }
  const exchange = (code: string) =>
    app.inject({ method: 'POST', url: '/auth/google/exchange', payload: { code } });
  const refreshWith = (cookie: string) =>
    app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie } });

  it('advertises Google as available', async () => {
    expect((await app.inject({ method: 'GET', url: '/auth/providers' })).json()).toEqual({
      google: true,
    });
  });

  it('redirects to Google with state and a short-lived httpOnly cookie', async () => {
    const { start } = await signIn({ email: uniqueEmail() });
    expect(start.statusCode).toBe(302);
    expect(start.headers.location).toMatch(
      /^https:\/\/accounts\.google\.test\/auth\?state=[\w-]{20,}&code_challenge=/,
    );
    const c = String(start.headers['set-cookie']);
    expect(c).toMatch(/^qa_oauth=/);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Max-Age=600');
  });

  it('creates a passwordless, verified account and starts a session', async () => {
    const email = uniqueEmail();
    const { cb, ex } = await signIn({ email, name: 'Ольга' }, '/quiz/sql');
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toMatch(
      /^http:\/\/localhost:5173\/#\/auth\/google\?code=[\w-]{40,}&next=%2Fquiz%2Fsql$/,
    );
    // The callback navigation itself sets no session cookie; the app's fetch exchange does.
    expect(refreshCookie(cb)).toBeUndefined();
    expect(ex!.statusCode).toBe(200);
    expect(ex!.json<AuthResponse>().user.email).toBe(email);
    const session = await refreshWith(refreshCookie(ex!)!);
    expect(session.statusCode).toBe(200);
    expect(session.json<AuthResponse>().user).toMatchObject({
      email,
      displayName: 'Ольга',
      timeZone: 'Europe/Kyiv',
    });
    const user = await testDb().user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ passwordHash: null, emailVerified: true });
  });

  it('signs the same Google account into the same user next time', async () => {
    const email = uniqueEmail();
    const sub = randomUUID();
    await signIn({ email, sub });
    await signIn({ email, sub });
    expect(await testDb().user.count({ where: { email } })).toBe(1);
    expect(await testDb().oAuthAccount.count({ where: { providerUserId: sub } })).toBe(1);
  });

  it('links to an existing password account with the same email, dropping the unproven password', async () => {
    const r = await register(app); // email/password account, email never verified
    const { ex } = await signIn({ email: r.email });
    const session = await refreshWith(refreshCookie(ex!)!);
    expect(session.json<AuthResponse>().user.id).toBe(r.user.id);

    // Whoever set that password may not own the inbox: it's gone, and so are its sessions.
    expect((await refreshWith(r.cookie)).statusCode).toBe(401);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: r.email, password: 'correct horse battery' },
    });
    expect(login.statusCode).toBe(401);
  });

  it('login codes work once and expire', async () => {
    const { loginCode, ex } = await signIn({ email: uniqueEmail() });
    expect(ex!.statusCode).toBe(200);
    const again = await exchange(loginCode!);
    expect(again.statusCode).toBe(401);
    expect(again.json()).toMatchObject({ error: 'google_code_invalid' });

    const user = await testDb().user.findUniqueOrThrow({
      where: { id: ex!.json<AuthResponse>().user.id },
    });
    const stale = randomUUID() + randomUUID();
    await testDb().loginCode.create({
      data: { codeHash: hashToken(stale), userId: user.id, expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await exchange(stale)).statusCode).toBe(401);
    expect((await exchange('x'.repeat(43))).statusCode).toBe(401);
  });

  it('refuses unverified Google emails', async () => {
    const email = uniqueEmail();
    const { cb } = await signIn({ email, emailVerified: false });
    expect(cb.headers.location).toBe('http://localhost:5173/#/login?error=google_email_unverified');
    expect(await testDb().user.count({ where: { email } })).toBe(0);
  });

  it('rejects a callback whose state does not match the cookie (CSRF)', async () => {
    const { oauthCookie, code } = await signIn({ email: uniqueEmail() });
    const forged = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=${code}&state=attacker-state`,
      headers: { cookie: oauthCookie },
    });
    expect(forged.headers.location).toBe('http://localhost:5173/#/login?error=google_state');
    const noCookie = await app.inject({
      method: 'GET',
      url: `/auth/google/callback?code=${code}&state=x`,
    });
    expect(noCookie.headers.location).toContain('error=google_state');
  });

  it('handles the user cancelling at Google', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/google/callback?error=access_denied',
    });
    expect(res.headers.location).toBe('http://localhost:5173/#/login?error=google_cancelled');
  });

  it('never redirects outside the app (open-redirect guard)', async () => {
    for (const next of ['//evil.example', 'https://evil.example', '/ok\\@evil']) {
      const { cb } = await signIn({ email: uniqueEmail() }, next);
      expect(landing(cb)).toMatchObject({ path: '/auth/google', next: '/dash' });
    }
  });

  it('reports Google as unavailable when not configured', async () => {
    const plain = await buildApp({
      db: testDb(),
      webOrigin: 'http://localhost:5173',
      jwtSecret: JWT_SECRET,
    });
    try {
      expect((await plain.inject({ method: 'GET', url: '/auth/providers' })).json()).toEqual({
        google: false,
      });
      expect((await plain.inject({ method: 'GET', url: '/auth/google' })).statusCode).toBe(404);
    } finally {
      await plain.close();
    }
  });
});
