import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { JWT_SECRET, testDb, TEST_URL, uniqueEmail } from './helpers';

const WEB = 'https://ryanchynskyi.github.io';

describe.skipIf(!TEST_URL)('web app on another site than the API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp({
      db: testDb(),
      webOrigin: WEB,
      jwtSecret: JWT_SECRET,
      cookieSecure: true,
      crossSiteCookies: true,
      authRateLimit: 10_000,
    });
  });
  afterAll(() => app.close());

  const registerFrom = (origin?: string) =>
    app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: origin ? { origin } : {},
      payload: { email: uniqueEmail(), password: 'correct horse battery', timeZone: 'UTC' },
    });

  it('sets a SameSite=None; Secure; Partitioned refresh cookie', async () => {
    const res = await registerFrom(WEB);
    expect(res.statusCode).toBe(201);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/^qa_rt=/);
    expect(cookie).toContain('SameSite=None');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Partitioned');
    expect(cookie).toContain('HttpOnly');
  });

  it('refuses writes from other sites (CSRF), allows reads', async () => {
    const res = await registerFrom('https://evil.example');
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'bad_origin' });
    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { origin: 'https://evil.example', cookie: 'qa_rt=whatever' },
    });
    expect(refresh.statusCode).toBe(403);
    const read = await app.inject({
      method: 'GET',
      url: '/auth/providers',
      headers: { origin: 'https://evil.example' },
    });
    expect(read.statusCode).toBe(200);
  });

  it('lets the web app send every method the API uses (CORS preflight)', async () => {
    for (const method of ['PATCH', 'DELETE']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/me',
        headers: {
          origin: WEB,
          'access-control-request-method': method,
          'access-control-request-headers': 'authorization,content-type',
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(WEB);
      expect(String(res.headers['access-control-allow-methods'])).toContain(method);
      expect(String(res.headers['access-control-allow-headers'])).toMatch(/authorization/i);
    }
  });

  it('config insists on HTTPS for cross-site cookies', () => {
    const base = { DATABASE_URL: 'postgresql://x@localhost/db', JWT_SECRET };
    expect(() => loadConfig({ ...base, COOKIE_SAMESITE: 'none' })).toThrow(/COOKIE_SECURE/);
    expect(
      loadConfig({ ...base, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' }).cookieSecure,
    ).toBe(true);
  });
});

describe('behind a hosting proxy', () => {
  it('trusts only the given number of proxy hops for the client IP', async () => {
    const app = await buildApp({
      db: testDb(),
      webOrigin: WEB,
      jwtSecret: JWT_SECRET,
      trustProxy: 1,
    });
    app.get('/__ip', async (req) => ({ ip: req.ip }));
    try {
      // The client spoofed 6.6.6.6; the proxy appended the address it saw (1.2.3.4).
      const res = await app.inject({
        method: 'GET',
        url: '/__ip',
        headers: { 'x-forwarded-for': '6.6.6.6, 1.2.3.4' },
      });
      expect(res.json()).toEqual({ ip: '1.2.3.4' });
    } finally {
      await app.close();
    }
  });

  it('keys rate limits on the edge-provided client IP header', async () => {
    const app = await buildApp({
      db: testDb(),
      webOrigin: WEB,
      jwtSecret: JWT_SECRET,
      authRateLimit: 2,
      clientIpHeader: 'true-client-ip',
    });
    const login = (ip: string, xff = '9.9.9.9') =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
        // A client can put anything in X-Forwarded-For; the edge overwrites True-Client-IP.
        headers: { 'true-client-ip': ip, 'x-forwarded-for': xff },
        payload: { email: uniqueEmail(), password: 'wrong-password' },
      });
    try {
      expect((await login('1.2.3.4', '1.1.1.1')).statusCode).toBe(401);
      expect((await login('1.2.3.4', '2.2.2.2')).statusCode).toBe(401);
      expect((await login('1.2.3.4', '3.3.3.3')).statusCode).toBe(429);
      expect((await login('5.6.7.8')).statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('parses TRUST_PROXY', () => {
    const base = { DATABASE_URL: 'postgresql://x@localhost/db', JWT_SECRET };
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(loadConfig({ ...base, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(loadConfig(base).TRUST_PROXY).toBe(false);
    expect(() => loadConfig({ ...base, TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
  });
});
