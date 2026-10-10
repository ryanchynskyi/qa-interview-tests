/** Validation for `POST /me/import` payloads (see `import.ts`). Server-side only. */
import { z } from 'zod';

const id = z.string().min(1).max(64);
const time = z.number().int().nonnegative();

export const importPayloadSchema = z.object({
  source: z.enum(['guest', 'legacy']),
  questions: z
    .record(
      id,
      z.object({
        lastResult: z.union([z.literal(0), z.literal(1)]),
        attempts: z.number().int().min(1).max(100_000).optional(),
        answeredAt: time.optional(),
      }),
    )
    .refine((r) => Object.keys(r).length <= 5000, 'too many questions'),
  cards: z
    .record(
      id,
      z.object({
        rating: z.number().int().min(1).max(5),
        reviews: z.number().int().min(1).max(100_000),
        dueAt: time,
        history: z.array(z.number().int().min(1).max(5)).max(5),
      }),
    )
    .refine((r) => Object.keys(r).length <= 2000, 'too many cards'),
  articlesRead: z
    .record(id, time)
    .refine((r) => Object.keys(r).length <= 2000, 'too many articles'),
  attempts: z
    .record(
      id,
      z
        .array(
          z.object({
            at: time,
            n: z.number().int().min(1).max(1000),
            y: z.number().int().min(0).max(1000),
          }),
        )
        .max(20),
    )
    .refine((r) => Object.keys(r).length <= 100, 'too many sections'),
});
export type ImportPayload = z.infer<typeof importPayloadSchema>;
