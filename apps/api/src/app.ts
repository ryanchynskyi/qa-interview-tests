import Fastify, { type FastifyRequest, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Catalog } from '@qa-hub/shared';
import { ZodError } from 'zod';
import type { GoogleOAuth } from './auth/google';
import { verifyAccessToken } from './auth/tokens';
import { catalogCache } from './content/catalog';
import { HttpError, unauthorized } from './lib/errors';
import { ProgressService } from './progress/service';
import { authRoutes } from './routes/auth';
import { googleRoutes } from './routes/google';
import { contentRoutes } from './routes/content';
import { healthRoutes } from './routes/health';
import { kbRoutes } from './routes/kb';
import { meRoutes } from './routes/me';
import { quizRoutes } from './routes/quiz';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
    /** Injected clock: tests move time across local midnights. */
    now: () => number;
    auth: { jwtSecret: string; cookieSecure: boolean; rateLimit: number };
    catalog: () => Promise<Catalog>;
    progress: ProgressService;
    /** Null when GOOGLE_* isn't configured. */
    google: GoogleOAuth | null;
    /** Where the web app lives; OAuth callbacks redirect here (+ #/route). */
    webAppUrl: string;
    /** User id from a valid Bearer token, null without one; 401 for an invalid token. */
    optionalUser: (req: FastifyRequest) => Promise<string | null>;
    /** User id from a valid Bearer token, else a 401. */
    requireUser: (req: FastifyRequest) => Promise<string>;
  }
}

export interface AppDeps {
  db: PrismaClient;
  webOrigin: string;
  jwtSecret: string;
  cookieSecure?: boolean;
  now?: () => number;
  /** Register/login attempts per IP per minute (tests raise it). */
  authRateLimit?: number;
  google?: GoogleOAuth | null;
  /** Defaults to `${webOrigin}/`. */
  webAppUrl?: string;
  logger?: FastifyServerOptions['logger'];
}

/**
 * Builds the app without listening, so tests can drive it with `app.inject()`
 * and pass their own database and clock.
 */
export async function buildApp({
  db,
  webOrigin,
  jwtSecret,
  cookieSecure = false,
  now = Date.now,
  authRateLimit = 10,
  google = null,
  webAppUrl = `${webOrigin}/`,
  logger = false,
}: AppDeps) {
  const app = Fastify({ logger });

  app.decorate('db', db);
  app.decorate('now', now);
  app.decorate('auth', { jwtSecret, cookieSecure, rateLimit: authRateLimit });
  app.decorate('catalog', catalogCache(db));
  app.decorate('progress', new ProgressService(db, app.catalog, now));
  app.decorate('google', google);
  app.decorate('webAppUrl', webAppUrl);

  const bearer = (req: FastifyRequest) => {
    const h = req.headers.authorization;
    return h?.startsWith('Bearer ') ? h.slice(7) : null;
  };
  app.decorate('optionalUser', async (req: FastifyRequest) => {
    const token = bearer(req);
    if (!token) return null;
    const userId = await verifyAccessToken(token, jwtSecret, now());
    // A present-but-invalid token is an error, so the client knows to refresh it.
    if (!userId) throw unauthorized('Сесія закінчилась');
    return userId;
  });
  app.decorate('requireUser', async (req: FastifyRequest) => {
    const userId = await app.optionalUser(req);
    if (!userId) throw unauthorized();
    return userId;
  });

  await app.register(cors, { origin: webOrigin, credentials: true });
  await app.register(cookie);
  // Opt-in per route via `config.rateLimit`.
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const message = err.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return reply.code(400).send({ error: 'bad_request', message });
    }
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({
        error: status === 429 ? 'rate_limited' : 'bad_request',
        message: (err as Error).message,
      });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal', message: 'Internal server error' });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  await app.register(healthRoutes);
  await app.register(contentRoutes);
  await app.register(quizRoutes);
  await app.register(kbRoutes);
  await app.register(authRoutes);
  await app.register(googleRoutes);
  await app.register(meRoutes);

  return app;
}
