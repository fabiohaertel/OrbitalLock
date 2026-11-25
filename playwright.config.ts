import { defineConfig, devices } from '@playwright/test';

const PORT = 5199;

/**
 * Browser tests (e2e/). They run against the Vite dev server, because the test
 * hook (`window.__orbitalLock`) and URL overrides exist only in development builds.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Each test runs Phaser with software WebGL; too many at once starve the CPU and
  // slow game time enough to time out. Two workers keep runs fast and stable.
  workers: 2,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
