import type { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { AuthResponse, AuthUser } from '@qa-hub/shared';
import {
  hashToken,
  newRefreshToken,
  REFRESH_COOKIE,
  REFRESH_TTL_DAYS,
  signAccessToken,
} from './tokens';

const DAY_MS = 86_400_000;

type UserRow = { id: string; email: string; displayName: string; timeZone: string };

export const toAuthUser = (u: UserRow): AuthUser => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  timeZone: u.timeZone,
});

export const cookieOptions = (app: FastifyInstance) => ({
  httpOnly: true,
  path: '/',
  ...(app.auth.crossSite
    ? // Cross-site fetches only carry SameSite=None cookies; Partitioned (CHIPS) keeps them
      // working where unpartitioned third-party cookies are blocked.
      { sameSite: 'none' as const, secure: true, partitioned: true }
    : { sameSite: 'lax' as const, secure: app.auth.cookieSecure }),
});

/** New refresh token (same family on rotation) + access token; sets the cookie on the reply. */
export async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: UserRow,
  familyId: string = randomUUID(),
): Promise<AuthResponse> {
  const now = app.now();
  const token = newRefreshToken();
  await app.db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      familyId,
      expiresAt: new Date(now + REFRESH_TTL_DAYS * DAY_MS),
    },
  });
  reply.setCookie(REFRESH_COOKIE, token, {
    ...cookieOptions(app),
    maxAge: REFRESH_TTL_DAYS * 86_400,
  });
  return {
    accessToken: await signAccessToken(user.id, app.auth.jwtSecret, now),
    user: toAuthUser(user),
  };
}

export const clearSessionCookie = (app: FastifyInstance, reply: FastifyReply) =>
  reply.clearCookie(REFRESH_COOKIE, cookieOptions(app));
