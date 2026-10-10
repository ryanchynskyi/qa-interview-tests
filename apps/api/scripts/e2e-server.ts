/**
 * API server for the Playwright end-to-end tests (see playwright.config.ts). It prepares
 * its own database on start and swaps Google for a stand-in whose consent screen is a
 * test-only route on this server. Production uses src/server.ts, which has neither.
 *
 * Env: E2E_DATABASE_URL (required), PORT (default 3100), WEB_ORIGIN (default
 * http://localhost:4173). The browser reaches this API through the web server's /api proxy.
 */
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app';
import type { GoogleIdentity, GoogleOAuth } from '../src/auth/google';
import { prepareDatabase } from '../test/global-setup';

const dbUrl = process.env.E2E_DATABASE_URL;
if (!dbUrl) throw new Error('E2E_DATABASE_URL is not set');
const port = Number(process.env.PORT ?? 3100);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:4173';
/** The API as the browser sees it. */
const publicApi = `${webOrigin}/api`;

await prepareDatabase(dbUrl);

const encode = (id: GoogleIdentity) => Buffer.from(JSON.stringify(id)).toString('base64url');
const fakeGoogle: GoogleOAuth = {
  authorizationUrl: (state) => `${publicApi}/__e2e/google?state=${encodeURIComponent(state)}`,
  // The "code" carries the identity picked on the fake consent screen.
  exchangeCode: async (code) =>
    JSON.parse(Buffer.from(code, 'base64url').toString()) as GoogleIdentity,
};

const db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const app = await buildApp({
  db,
  webOrigin,
  jwtSecret: 'e2e-secret-that-is-long-enough-1234567890',
  google: fakeGoogle,
  // Every test browser comes from the same IP.
  rateLimits: false,
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Stand-in for Google's account chooser. */
app.get<{ Querystring: { state?: string } }>('/__e2e/google', async (req, reply) => {
  const state = esc(req.query.state ?? '');
  return reply.type('text/html').send(`<!doctype html>
<meta charset="utf-8"><title>Fake Google</title>
<form method="get" action="${publicApi}/__e2e/google/consent">
  <input type="hidden" name="state" value="${state}">
  <label>Email <input name="email" type="email" required></label>
  <label>Name <input name="name"></label>
  <button type="submit">Continue</button>
  <button type="submit" name="deny" value="1" formnovalidate>Cancel</button>
</form>`);
});

app.get<{ Querystring: { state?: string; email?: string; name?: string; deny?: string } }>(
  '/__e2e/google/consent',
  async (req, reply) => {
    const { state = '', email = '', name, deny } = req.query;
    const back = new URL(`${publicApi}/auth/google/callback`);
    back.searchParams.set('state', state);
    if (deny) back.searchParams.set('error', 'access_denied');
    else {
      const id: GoogleIdentity = {
        sub: `e2e-${email}`,
        email: email.toLowerCase(),
        emailVerified: true,
        name: name || null,
      };
      back.searchParams.set('code', encode(id));
    }
    return reply.redirect(back.toString(), 302);
  },
);

const shutdown = async () => {
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port, host: '127.0.0.1' });
