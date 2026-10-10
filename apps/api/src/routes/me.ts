import type { FastifyPluginAsync } from 'fastify';
import { finishQuizSchema, importPayloadSchema, rateCardSchema } from '@qa-hub/shared';

/** Progress endpoints for signed-in users. Answers go through POST /quiz/check. */
export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me/progress', async (req) => {
    const userId = await app.requireUser(req);
    return app.progress.snapshot(userId);
  });

  app.post('/me/quiz/finish', async (req) => {
    const userId = await app.requireUser(req);
    const body = finishQuizSchema.parse(req.body);
    return app.progress.finishQuiz(userId, body.sectionId, body.questionIds);
  });

  app.post('/me/recall/rate', async (req) => {
    const userId = await app.requireUser(req);
    const body = rateCardSchema.parse(req.body);
    return app.progress.rate(userId, body.cardId, body.rating);
  });

  app.post<{ Params: { id: string } }>('/me/articles/:id/read', async (req) => {
    const userId = await app.requireUser(req);
    return app.progress.readArticle(userId, req.params.id);
  });

  /** Guest or legacy progress → this account. Rate limited: it's a heavy write. */
  app.post(
    '/me/import',
    {
      config: { rateLimit: { max: app.auth.rateLimit, timeWindow: '1 minute' } },
      bodyLimit: 2 * 1024 * 1024,
    },
    async (req) => {
      const userId = await app.requireUser(req);
      return app.progress.importProgress(userId, importPayloadSchema.parse(req.body));
    },
  );

  app.post<{ Params: { id: string } }>('/me/sections/:id/reset', async (req, reply) => {
    const userId = await app.requireUser(req);
    await app.progress.resetSection(userId, req.params.id);
    return reply.code(204).send();
  });
};
