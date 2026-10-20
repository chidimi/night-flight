import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 600 } },
    },
  ],
  webServer: {
    // Build afresh so E2E never exercises stale output or Vite's dev transforms.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    timeout: 120_000,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
