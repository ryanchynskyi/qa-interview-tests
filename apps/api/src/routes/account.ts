import type { FastifyPluginAsync } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import {
  addDays,
  changePasswordSchema,
  deleteAccountSchema,
  localDate,
  type AccountInfo,
  type XpDay,
} from '@qa-hub/shared';
import { clearSessionCookie, toAuthUser } from '../auth/session';
import { hashToken, REFRESH_COOKIE } from '../auth/tokens';
import { HttpError } from '../lib/errors';

const DAY_MS = 86_400_000;

/** Profile endpoints: account details, password, XP history, deletion. */
export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me/account', async (req) => {
    const userId = await app.requireUser(req);
    const user = await app.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { oauthAccounts: { select: { provider: true } } },
    });
    const changed = user.timeZoneChangedAt?.getTime();
    const lockedUntil = changed && changed + DAY_MS > app.now() ? changed + DAY_MS : null;
    const info: AccountInfo = {
      ...toAuthUser(user),
      createdAt: user.createdAt.getTime(),
      hasPassword: !!user.passwordHash,
      providers: [...new Set(user.oauthAccounts.map((a) => a.provider))],
      timeZoneLockedUntil: lockedUntil,
    };
    return info;
  });

  /**
   * Sets or changes the password. Changing requires the current one; Google-only
   * accounts may set a first password. Other sessions are signed out.
   */
  app.post(
    '/me/password',
    { config: { rateLimit: { max: app.auth.rateLimit, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const userId = await app.requireUser(req);
      const body = changePasswordSchema.parse(req.body);
      const user = await app.db.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.passwordHash) {
        if (!body.currentPassword || !(await verify(user.passwordHash, body.currentPassword))) {
          throw new HttpError(401, 'invalid_credentials', 'Поточний пароль невірний');
        }
      }
      const now = new Date(app.now());
      const token = req.cookies[REFRESH_COOKIE];
      const current = token
        ? await app.db.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } })
        : null;
      await app.db.$transaction([
        app.db.user.update({
          where: { id: userId },
          data: { passwordHash: await hash(body.newPassword) },
        }),
        app.db.refreshToken.updateMany({
          where: {
            userId,
            revokedAt: null,
            ...(current ? { familyId: { not: current.familyId } } : {}),
          },
          data: { revokedAt: now },
        }),
      ]);
      return reply.code(204).send();
    },
  );

  /** XP per local day for the last `days` days (zeros included), for the profile chart. */
  app.get<{ Querystring: { days?: string } }>('/me/xp-history', async (req) => {
    const userId = await app.requireUser(req);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const user = await app.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timeZone: true },
    });
    const now = app.now();
    const today = localDate(now, user.timeZone);
    const first = addDays(today, -(days - 1));
    // A day of margin on each side, then bucket by the user's local date.
    const events = await app.db.xpEvent.findMany({
      where: { userId, at: { gte: new Date(now - (days + 1) * DAY_MS) } },
      select: { amount: true, at: true },
    });
    const byDate = new Map<string, number>();
    for (const e of events) {
      const d = localDate(e.at.getTime(), user.timeZone);
      if (d >= first && d <= today) byDate.set(d, (byDate.get(d) ?? 0) + e.amount);
    }
    const out: XpDay[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(first, i);
      out.push({ date, xp: byDate.get(date) ?? 0 });
    }
    return out;
  });

  /** Deletes the account and all its progress (cascades). The email must be typed to confirm. */
  app.delete('/me', async (req, reply) => {
    const userId = await app.requireUser(req);
    const body = deleteAccountSchema.parse(req.body);
    const user = await app.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (body.confirmEmail !== user.email) {
      throw new HttpError(400, 'confirm_mismatch', 'Email для підтвердження не збігається');
    }
    await app.db.user.delete({ where: { id: userId } });
    clearSessionCookie(app, reply);
    return reply.code(204).send();
  });
};
