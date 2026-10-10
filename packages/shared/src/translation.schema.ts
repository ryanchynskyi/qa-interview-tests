import { z } from 'zod';
import { CONTENT_LANGS, type ContentTranslation } from './translation';

export const contentLangSchema = z.enum(CONTENT_LANGS);

/** `?lang=` on content requests: Ukrainian unless asked otherwise. */
export const langQuerySchema = z.object({
  lang: contentLangSchema.catch('uk').default('uk'),
});

const text = z.string().min(1);
const map = <T extends z.ZodType>(v: T) => z.record(z.string(), v).default({});

export const contentTranslationSchema = z.object({
  topics: map(z.object({ name: text.optional() })),
  sections: map(z.object({ name: text.optional(), description: z.string().optional() })),
  chapters: map(z.object({ title: text.optional(), subtitle: z.string().optional() })),
  groups: map(text),
  questions: map(
    z.object({
      text: text.optional(),
      code: z.string().optional(),
      options: z.array(text).optional(),
      explanation: text.optional(),
    }),
  ),
  recallCards: map(z.object({ question: text.optional(), answer: text.optional() })),
  articles: map(z.object({ title: text.optional(), html: text.optional() })),
}) satisfies z.ZodType<ContentTranslation, unknown>;
