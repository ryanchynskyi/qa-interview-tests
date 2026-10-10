import type { FastifyPluginAsync } from 'fastify';
import { checkAnswerSchema, type CheckAnswerWithProgress } from '@qa-hub/shared';

export const quizRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Checks an answer server-side, so the correct option never ships with the question.
   * Guests get only the verdict; for a signed-in user the answer is also recorded.
   */
  app.post(
    '/quiz/check',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = checkAnswerSchema.parse(req.body);
      const userId = await app.optionalUser(req);
      const q = await app.db.question.findUnique({
        where: { id: body.questionId },
        select: { correctIndex: true, explanation: true, options: true },
      });
      if (!q) return reply.code(404).send({ error: 'not_found', message: 'Unknown question' });
      if (body.choice !== null && body.choice >= q.options.length) {
        return reply.code(400).send({ error: 'bad_request', message: 'choice: out of range' });
      }
      const outcome =
        body.choice === null ? 'skipped' : body.choice === q.correctIndex ? 'correct' : 'wrong';
      const res: CheckAnswerWithProgress = {
        outcome,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      };
      if (userId) res.progress = await app.progress.answer(userId, body.questionId, outcome);
      return res;
    },
  );
};
