import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// End-to-end tests: the built web app (vite preview, :4173) in front of a dedicated API (:3100)
// with its own database and a stand-in for Google (apps/api/scripts/e2e-server.ts). Ports differ
// from the dev servers, so both can run at once.
const API_PORT = 3100;
const WEB_PORT = 4173;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

// Locally the e2e database sits next to TEST_DATABASE_URL from apps/api/.env; CI sets it directly.
const testDbUrl =
  process.env.TEST_DATABASE_URL ?? loadEnv('test', 'apps/api', 'TEST_').TEST_DATABASE_URL;
const e2eDbUrl =
  process.env.E2E_DATABASE_URL ??
  (testDbUrl && Object.assign(new URL(testDbUrl), { pathname: '/qahub_e2e' }).toString());
if (!e2eDbUrl) throw new Error('Set E2E_DATABASE_URL or TEST_DATABASE_URL (apps/api/.env)');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_ORIGIN,
    // Daily tasks reset at local midnight; pin the zone so runs near midnight stay stable.
    timezoneId: 'Europe/Kyiv',
    locale: 'uk-UA',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'node --import tsx apps/api/scripts/e2e-server.ts',
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: { E2E_DATABASE_URL: e2eDbUrl, PORT: String(API_PORT), WEB_ORIGIN },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      name: 'web',
      command: `npm run build && node ../../node_modules/vite/bin/vite.js preview --port ${WEB_PORT} --strictPort`,
      cwd: 'apps/web',
      url: WEB_ORIGIN,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
