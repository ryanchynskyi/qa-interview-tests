import type { FastifyPluginAsync } from 'fastify';
import { checkAnswerSchema, type CheckAnswerResponse } from '@qa-hub/shared';

export const quizRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Checks an answer server-side, so the correct option never ships with the question.
   * Works without login; once auth lands (M4) a logged-in call will also record progress.
   */
  app.post(
    '/quiz/check',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = checkAnswerSchema.parse(req.body);
      const q = await app.db.question.findUnique({
        where: { id: body.questionId },
        select: { correctIndex: true, explanation: true, options: true },
      });
      if (!q) return reply.code(404).send({ error: 'not_found', message: 'Unknown question' });
      if (body.choice !== null && body.choice >= q.options.length) {
        return reply.code(400).send({ error: 'bad_request', message: 'choice: out of range' });
      }
      const res: CheckAnswerResponse = {
        outcome:
          body.choice === null ? 'skipped' : body.choice === q.correctIndex ? 'correct' : 'wrong',
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      };
      return res;
    },
  );
};
