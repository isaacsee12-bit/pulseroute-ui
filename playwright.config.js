import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: 'ui.spec.js',
  use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:4173', browserName: 'chromium' },
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm run preview',
    url: 'http://localhost:4173/api/health',
    env: { PORT: '4173' },
    reuseExistingServer: false,
  },
});
