import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import { isValidTimeZone, loginSchema, registerSchema, updateMeSchema } from '@qa-hub/shared';
import { clearSessionCookie, issueSession, toAuthUser } from '../auth/session';
import { hashToken, REFRESH_COOKIE } from '../auth/tokens';
import { HttpError, unauthorized } from '../lib/errors';

const DAY_MS = 86_400_000;
/** A token rotated this recently is treated as a benign race (two tabs refreshing), not theft. */
const REUSE_GRACE_MS = 30_000;
/** Users may move their time zone once a day, so they can't farm extra daily-task sets. */
const TZ_CHANGE_COOLDOWN_MS = DAY_MS;

// Verifying against a real hash when the email is unknown keeps response times uniform.
const DUMMY_HASH = hash('not-a-real-password-just-for-timing');

export const authRoutes: FastifyPluginAsync = async (app) => {
  const authLimit = { rateLimit: { max: app.auth.rateLimit, timeWindow: '1 minute' } };
  const issue = (
    reply: FastifyReply,
    user: Parameters<typeof issueSession>[2],
    familyId?: string,
  ) => issueSession(app, reply, user, familyId);
  const clearCookie = (reply: FastifyReply) => clearSessionCookie(app, reply);

  app.post('/auth/register', { config: authLimit }, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const exists = await app.db.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (exists) throw new HttpError(409, 'email_taken', 'Акаунт з таким email вже існує');
    const user = await app.db.user.create({
      data: {
        email: body.email,
        passwordHash: await hash(body.password),
        displayName: body.displayName ?? body.email.split('@')[0]!,
        timeZone: isValidTimeZone(body.timeZone) ? body.timeZone : 'UTC',
        stats: { create: {} },
      },
    });
    const session = await issue(reply, user);
    return reply.code(201).send(session);
  });

  app.post('/auth/login', { config: authLimit }, async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await app.db.user.findUnique({ where: { email: body.email } });
    const ok = await verify(user?.passwordHash ?? (await DUMMY_HASH), body.password);
    if (!user || !user.passwordHash || !ok) {
      throw new HttpError(401, 'invalid_credentials', 'Невірний email або пароль');
    }
    return issue(reply, user);
  });

  app.post(
    '/auth/refresh',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const token = req.cookies[REFRESH_COOKIE];
      if (!token) throw unauthorized('Сесія закінчилась');
      const row = await app.db.refreshToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });
      const now = app.now();
      if (!row) {
        clearCookie(reply);
        throw unauthorized('Сесія закінчилась');
      }
      if (row.revokedAt) {
        // Reuse of a rotated token: unless it's a near-simultaneous refresh from another
        // tab, assume it was stolen and end every session of this family.
        if (now - row.revokedAt.getTime() > REUSE_GRACE_MS) {
          await app.db.refreshToken.updateMany({
            where: { familyId: row.familyId, revokedAt: null },
            data: { revokedAt: new Date(now) },
          });
          clearCookie(reply);
        }
        throw unauthorized('Сесія закінчилась');
      }
      if (row.expiresAt.getTime() <= now) {
        clearCookie(reply);
        throw unauthorized('Сесія закінчилась');
      }
      // Rotate: the old token dies only if it's still live (guards against parallel use).
      const { count } = await app.db.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date(now) },
      });
      if (!count) throw unauthorized('Сесія закінчилась');
      return issue(reply, row.user, row.familyId);
    },
  );

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      await app.db.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date(app.now()) },
      });
    }
    clearCookie(reply);
    return reply.code(204).send();
  });

  app.get('/auth/me', async (req) => {
    const userId = await app.requireUser(req);
    const user = await app.db.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized();
    return toAuthUser(user);
  });

  app.patch('/me', async (req: FastifyRequest) => {
    const userId = await app.requireUser(req);
    const body = updateMeSchema.parse(req.body);
    const user = await app.db.user.findUniqueOrThrow({ where: { id: userId } });
    const data: { displayName?: string; timeZone?: string; timeZoneChangedAt?: Date } = {};
    if (body.displayName) data.displayName = body.displayName;
    if (body.timeZone && body.timeZone !== user.timeZone) {
      if (!isValidTimeZone(body.timeZone))
        throw new HttpError(400, 'bad_request', 'timeZone: unknown zone');
      const last = user.timeZoneChangedAt?.getTime();
      if (last && app.now() - last < TZ_CHANGE_COOLDOWN_MS) {
        throw new HttpError(429, 'tz_cooldown', 'Часовий пояс можна змінювати раз на добу');
      }
      data.timeZone = body.timeZone;
      data.timeZoneChangedAt = new Date(app.now());
    }
    const updated = await app.db.user.update({ where: { id: userId }, data });
    return toAuthUser(updated);
  });
};
