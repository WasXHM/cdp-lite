import { defineConfig } from '@playwright/test';

const testEnv = {
  NODE_ENV: 'test', API_PORT: '3001', WEB_PORT: '5174', CORS_ORIGIN: 'http://127.0.0.1:5174',
  DATABASE_NAME: 'cdp_lite_test', DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '3307',
  DATABASE_USER: 'cdp_lite', DATABASE_PASSWORD: 'change_me',
};
export default defineConfig({
  testDir: './e2e', timeout: 120000, expect: { timeout: 10000 }, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 1000 },
    channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 10000, navigationTimeout: 20000,
  },
  webServer: [
    { command: 'pnpm db:migrate && pnpm --filter @cdp/webapi dev', url: 'http://127.0.0.1:3001/api/v1/metadata', env: testEnv, reuseExistingServer: false, timeout: 60000 },
    { command: 'pnpm --filter @cdp/webapp dev', url: 'http://127.0.0.1:5174', env: testEnv, reuseExistingServer: false, timeout: 60000 },
  ],
});
