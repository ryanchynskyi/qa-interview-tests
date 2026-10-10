import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

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
          // Picks up TEST_DATABASE_URL from apps/api/.env; CI sets it directly.
          env: loadEnv('test', 'apps/api', 'TEST_'),
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
