import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  /** Liveness + database check. Returns 503 when Postgres is unreachable. */
  app.get('/health', async (_req, reply) => {
    try {
      await app.db.$queryRaw`SELECT 1`;
      const [questions, recallCards, articles] = await Promise.all([
        app.db.question.count(),
        app.db.recallCard.count(),
        app.db.article.count(),
      ]);
      return { status: 'ok', db: 'up', content: { questions, recallCards, articles } };
    } catch (err) {
      app.log.error(err, 'health check: database unreachable');
      return reply.code(503).send({ status: 'degraded', db: 'down' });
    }
  });
};
