import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { contentRoutes } from './routes/content';
import { healthRoutes } from './routes/health';
import { kbRoutes } from './routes/kb';
import { quizRoutes } from './routes/quiz';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
  }
}

export interface AppDeps {
  db: PrismaClient;
  webOrigin: string;
  logger?: FastifyServerOptions['logger'];
}

/**
 * Builds the app without listening, so tests can drive it with `app.inject()`
 * and pass a fake database.
 */
export async function buildApp({ db, webOrigin, logger = false }: AppDeps) {
  const app = Fastify({ logger });

  app.decorate('db', db);
  await app.register(cors, { origin: webOrigin, credentials: true });
  // Opt-in per route via `config.rateLimit`.
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const message = err.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      return reply.code(400).send({ error: 'bad_request', message });
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

  return app;
}
