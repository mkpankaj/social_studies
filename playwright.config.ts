import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1,               // single worker — stable for hook-driven testing
  reporter: 'line',         // compact output, good for hook feedback to Claude

  use: {
    baseURL: 'http://localhost:3000',   // change to your dev server port
    headless: true,                     // headless for hook runs
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});