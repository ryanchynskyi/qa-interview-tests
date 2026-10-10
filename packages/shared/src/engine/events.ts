import type { AnswerOutcome } from './items';

/**
 * What a learner did. Daily tasks advance from these; the server and the guest store
 * build one per user action after updating the item itself.
 */
export type ActivityEvent =
  | {
      type: 'answer';
      at: number;
      questionId: string;
      sectionId: string;
      topicId: string;
      chapterId: string;
      outcome: AnswerOutcome;
    }
  | { type: 'quiz_finish'; at: number; sectionId: string; answered: number; correct: number }
  | {
      type: 'recall';
      at: number;
      cardId: string;
      topicId: string;
      chapterId: string;
      rating: number;
      wasDue: boolean;
    }
  | { type: 'article_read'; at: number; articleId: string; topicId: string; chapterId: string };
