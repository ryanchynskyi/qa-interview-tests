import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'), // set HOST=0.0.0.0 inside containers
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  /** Full URL of the web app (e.g. a GitHub Pages path); defaults to WEB_ORIGIN + '/'. */
  WEB_APP_URL: z.string().url().optional(),
  /** Google sign-in; all three or none. */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  /** HMAC key for access tokens. Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** Defaults to true in production; refresh cookies are then HTTPS-only. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /**
   * `none` when the web app is on another site than the API (GitHub Pages + a hosted API):
   * the refresh cookie becomes `SameSite=None; Secure; Partitioned`. Requires HTTPS.
   */
  COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),
  /**
   * Behind a hosting proxy: how many proxy hops to trust in X-Forwarded-For, so rate limits
   * see the client's IP instead of the proxy's. A hop count (e.g. 1) is safer than `true`,
   * which also trusts addresses a client put there itself.
   */
  TRUST_PROXY: z
    .string()
    .regex(/^(true|false|\d+)$/, 'TRUST_PROXY: true, false or a hop count')
    .default('false')
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : Number(v))),
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
  const cookieSecure = c.COOKIE_SECURE ?? c.NODE_ENV === 'production';
  if (c.COOKIE_SAMESITE === 'none' && !cookieSecure) {
    throw new Error('COOKIE_SAMESITE=none needs secure cookies: set COOKIE_SECURE=true (HTTPS).');
  }
  return { ...c, cookieSecure };
}
