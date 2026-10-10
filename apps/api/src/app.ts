import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import { healthRoutes } from './routes/health';

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

  await app.register(healthRoutes);

  return app;
}
