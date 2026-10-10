/**
 * Request schemas for the HTTP contract in `api.ts`. Kept apart so the web bundle,
 * which never validates requests itself, can leave zod out.
 */
import { z } from 'zod';

export const checkAnswerSchema = z.object({
  questionId: z.string().min(1).max(64),
  /** Index into `options`; null means skipped. */
  choice: z.number().int().min(0).max(9).nullable(),
});
export type CheckAnswerRequest = z.infer<typeof checkAnswerSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(40),
});

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Невірний email' }).max(254));
const password = z
  .string()
  .min(8, { message: 'Пароль: щонайменше 8 символів' })
  .max(128, { message: 'Пароль: не довше 128 символів' });

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(1).max(60).optional(),
  timeZone: z.string().min(1).max(64),
});
export type RegisterRequest = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  timeZone: z.string().min(1).max(64).optional(),
});

export const finishQuizSchema = z.object({
  sectionId: z.string().min(1).max(64),
  /** The run's questions; the server counts correct answers itself. */
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(200),
});

export const rateCardSchema = z.object({
  cardId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
});

export const changePasswordSchema = z.object({
  /** Required when the account already has a password. */
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: password,
});

export const deleteAccountSchema = z.object({
  /** Typed by the user to confirm; must equal the account email. */
  confirmEmail: z.string().trim().toLowerCase().max(254),
});
