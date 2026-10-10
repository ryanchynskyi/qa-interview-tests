import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'), // set HOST=0.0.0.0 inside containers
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  /** HMAC key for access tokens. Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Defaults to true in production; refresh cookies are then HTTPS-only. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type Config = z.infer<typeof envSchema> & { cookieSecure: boolean };

/** Parses process.env once at startup; fails fast with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  const c = parsed.data;
  return { ...c, cookieSecure: c.COOKIE_SECURE ?? c.NODE_ENV === 'production' };
}
