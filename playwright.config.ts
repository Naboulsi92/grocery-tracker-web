import { defineConfig, devices } from '@playwright/test';
import { resolveE2EEnvironment } from './quality/e2e-environment';

const e2eEnvironment = resolveE2EEnvironment(process.env);

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: 'test-results',
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: e2eEnvironment.baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: e2eEnvironment.isLocal
    ? {
        command: 'npm run dev -- --hostname 127.0.0.1',
        url: e2eEnvironment.baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      }
    : undefined,
});
