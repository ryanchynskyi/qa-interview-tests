import type { FastifyPluginAsync } from 'fastify';
import type { QuizQuestion, RecallCardDto } from '@qa-hub/shared';

export const contentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/content/catalog', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return app.catalog();
  });

  app.get<{ Params: { id: string } }>('/sections/:id/questions', async (req, reply) => {
    const section = await app.db.section.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!section) return reply.code(404).send({ error: 'not_found', message: 'Unknown section' });
    const questions: QuizQuestion[] = await app.db.question.findMany({
      where: { sectionId: section.id },
      orderBy: { order: 'asc' },
      // Deliberately no correctIndex / explanation: those come from POST /quiz/check.
      select: {
        id: true,
        sectionId: true,
        chapterId: true,
        group: true,
        level: true,
        text: true,
        code: true,
        options: true,
      },
    });
    reply.header('cache-control', 'public, max-age=300');
    return questions;
  });

  app.get('/recall/cards', async (_req, reply) => {
    const cards: RecallCardDto[] = await app.db.recallCard.findMany({
      orderBy: [{ topic: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        topicId: true,
        chapterId: true,
        group: true,
        question: true,
        answer: true,
      },
    });
    reply.header('cache-control', 'public, max-age=300');
    return cards;
  });
};
