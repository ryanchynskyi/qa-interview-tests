import type { Question } from './content.schema';

export const LEVELS = ['junior', 'middle', 'senior'] as const;
export type Level = (typeof LEVELS)[number];

/** Option text the legacy app always shows last in code-review questions. */
export const OK_TEXT = 'Код коректний, змін не потрібно';

/** What the browser receives before answering: no correct answer, no explanation. */
export type PublicQuestion = Omit<Question, 'correctIndex' | 'explanation'>;
