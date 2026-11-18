import { defineConfig, devices } from '@playwright/test';

const port = 8181;

/** End-to-end tests drive the real bundle on the local preview, which uses fictional data and never contacts a platform. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'en-US',
    colorScheme: 'light',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: 'node scripts/serve.cjs',
    env: { PORT: String(port) },
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
