import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// TEST_DATABASE_URL from apps/api/.env locally; CI sets it directly (env wins).
for (const [k, v] of Object.entries(loadEnv('test', 'apps/api', 'TEST_'))) process.env[k] ??= v;

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', root: 'packages/shared', include: ['test/**/*.test.ts'] } },
      { test: { name: 'content', root: 'packages/content', include: ['test/**/*.test.ts'] } },
      {
        test: {
          name: 'api',
          root: 'apps/api',
          include: ['test/**/*.test.ts'],
          globalSetup: ['test/global-setup.ts'],
          // Integration tests share one database; keep files sequential and generous.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          include: ['src/**/*.test.ts'],
        },
      },
    ],
  },
});
