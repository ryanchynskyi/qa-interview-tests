import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { isValidTimeZone } from '@qa-hub/shared';
import { newPkceVerifier, pkceChallenge, type GoogleIdentity } from '../auth/google';
import { issueSession } from '../auth/session';
import { HttpError } from '../lib/errors';

const OAUTH_COOKIE = 'qa_oauth';
const OAUTH_TTL_SECONDS = 10 * 60;

/** Only in-app hash routes: blocks open redirects like `//evil.example`. */
const safeNext = (v: unknown) =>
  typeof v === 'string' && /^\/(?!\/)[\w\-./?=&%]*$/.test(v) && v.length <= 200 ? v : '/dash';

interface OAuthState {
  /** CSRF state echoed back by Google. */
  s: string;
  /** PKCE verifier. */
  v: string;
  /** Where to land in the app afterwards. */
  n: string;
  /** Browser time zone, for a newly created account. */
  tz: string;
}

const encodeState = (o: OAuthState) => Buffer.from(JSON.stringify(o)).toString('base64url');
function decodeState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(Buffer.from(raw, 'base64url').toString()) as OAuthState;
    return typeof o.s === 'string' && typeof o.v === 'string' ? o : null;
  } catch {
    return null;
  }
}

const sameString = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Finds or creates the user for a Google identity.
 * - Known Google account → its user.
 * - Unknown, but a user has this (Google-verified) email → link to that user. If that
 *   account's email was never verified, its password and sessions are dropped: whoever
 *   set them may not own the address (pre-hijacking protection).
 * - Otherwise → a new passwordless user.
 */
export async function userForGoogle(
  db: PrismaClient,
  id: GoogleIdentity,
  timeZone: string,
  now: number,
) {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider: 'google', providerUserId: id.sub } },
    include: { user: true },
  });
  if (linked) return linked.user;
  if (!id.emailVerified) {
    throw new HttpError(403, 'google_email_unverified', 'Google has not verified this email');
  }

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: id.email } });
      if (existing) {
        if (!existing.emailVerified) {
          await tx.refreshToken.updateMany({
            where: { userId: existing.id, revokedAt: null },
            data: { revokedAt: new Date(now) },
          });
        }
        await tx.oAuthAccount.create({
          data: {
            provider: 'google',
            providerUserId: id.sub,
            userId: existing.id,
            email: id.email,
          },
        });
        return tx.user.update({
          where: { id: existing.id },
          data: existing.emailVerified ? {} : { emailVerified: true, passwordHash: null },
        });
      }
      return tx.user.create({
        data: {
          email: id.email,
          emailVerified: true,
          displayName: id.name ?? id.email.split('@')[0]!,
          timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
          stats: { create: {} },
          oauthAccounts: {
            create: { provider: 'google', providerUserId: id.sub, email: id.email },
          },
        },
      });
    });
  } catch (e) {
    // Two callbacks for the same new account raced; the other one won.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return userForGoogle(db, id, timeZone, now);
    }
    throw e;
  }
}

export const googleRoutes: FastifyPluginAsync = async (app) => {
  const cookie = {
    httpOnly: true,
    // Lax still reaches the callback: it's a top-level GET navigation back from Google.
    sameSite: 'lax' as const,
    secure: app.auth.cookieSecure,
    path: '/',
  };
  const toApp = (reply: FastifyReply, route: string) =>
    reply.redirect(`${app.webAppUrl}#${route}`, 302);
  const fail = (reply: FastifyReply, code: string) =>
    toApp(reply, `/login?error=${encodeURIComponent(code)}`);

  app.get('/auth/providers', async () => ({ google: !!app.google }));

  app.get<{ Querystring: { next?: string; tz?: string } }>(
    '/auth/google',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!app.google)
        throw new HttpError(404, 'google_disabled', 'Google sign-in is not configured');
      const state = randomBytes(24).toString('base64url');
      const verifier = newPkceVerifier();
      const tz = typeof req.query.tz === 'string' ? req.query.tz.slice(0, 64) : 'UTC';
      reply.setCookie(
        OAUTH_COOKIE,
        encodeState({ s: state, v: verifier, n: safeNext(req.query.next), tz }),
        { ...cookie, maxAge: OAUTH_TTL_SECONDS },
      );
      return reply.redirect(app.google.authorizationUrl(state, pkceChallenge(verifier)), 302);
    },
  );

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/auth/google/callback',
    async (req, reply) => {
      const saved = decodeState(req.cookies[OAUTH_COOKIE]);
      reply.clearCookie(OAUTH_COOKIE, cookie);
      if (!app.google) return fail(reply, 'google_disabled');
      if (req.query.error) return fail(reply, 'google_cancelled');
      if (!saved || !req.query.state || !sameString(saved.s, req.query.state)) {
        return fail(reply, 'google_state');
      }
      if (!req.query.code) return fail(reply, 'google_cancelled');

      try {
        const identity = await app.google.exchangeCode(req.query.code, saved.v);
        const user = await userForGoogle(app.db, identity, saved.tz, app.now());
        // Sets the refresh cookie; the app picks the session up with /auth/refresh on load.
        await issueSession(app, reply, user);
        return toApp(reply, saved.n);
      } catch (e) {
        req.log.warn({ err: e }, 'google sign-in failed');
        return fail(reply, e instanceof HttpError ? e.code : 'google_failed');
      }
    },
  );
};
