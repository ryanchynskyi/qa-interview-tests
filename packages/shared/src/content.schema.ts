/** Schemas for the extracted content bundle (`packages/content/data`). Server and tooling only. */
import { z } from 'zod';
import { LEVELS } from './content';

export const levelSchema = z.enum(LEVELS);

export const topicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int(),
});
export type Topic = z.infer<typeof topicSchema>;

export const sectionSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  order: z.number().int(),
});
export type Section = z.infer<typeof sectionSchema>;

export const chapterSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string(),
  order: z.number().int(),
});
export type Chapter = z.infer<typeof chapterSchema>;

export const articleSchema = z.object({
  /** `${chapterId}:${index}`, matching legacy `#/kb/topic/chapter/index` links. */
  id: z.string().min(1),
  chapterId: z.string().min(1),
  title: z.string().min(1),
  /** Source label shown in the UI, e.g. "Гайд". */
  kind: z.string(),
  level: levelSchema.nullable(),
  html: z.string().min(1),
  order: z.number().int(),
});
export type Article = z.infer<typeof articleSchema>;

export const questionSchema = z
  .object({
    id: z.string().min(1),
    sectionId: z.string().min(1),
    chapterId: z.string().min(1),
    /** Sub-topic label inside the section, used for quiz filters. */
    group: z.string().min(1),
    level: levelSchema,
    text: z.string().min(1),
    code: z.string(),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().min(1),
    order: z.number().int(),
  })
  .refine((q) => q.correctIndex < q.options.length, { message: 'correctIndex out of range' });
export type Question = z.infer<typeof questionSchema>;

export const recallCardSchema = z.object({
  id: z.string().min(1),
  topicId: z.string().min(1),
  chapterId: z.string().min(1),
  group: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  order: z.number().int(),
});
export type RecallCard = z.infer<typeof recallCardSchema>;

export const contentBundleSchema = z.object({
  topics: z.array(topicSchema),
  sections: z.array(sectionSchema),
  chapters: z.array(chapterSchema),
  articles: z.array(articleSchema),
  questions: z.array(questionSchema),
  recallCards: z.array(recallCardSchema),
});
export type ContentBundle = z.infer<typeof contentBundleSchema>;
