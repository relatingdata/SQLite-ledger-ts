import { defineConfig, devices } from '@playwright/test';

/**
 * Real, end-to-end browser tests against the actual running app — a
 * genuinely different layer from `make test` (isolated unit tests)
 * and `make test-e2e` (the deterministic simulation's exact expected
 * values). This layer catches what neither of those can: whether a
 * real browser, clicking through real pages, actually shows what it
 * should. Two real bugs from this project's history are exactly what
 * this layer exists to catch going forward — a duplicate menu entry,
 * and a cart line showing $0.00 because a real lookup silently never
 * happened.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // tests share one real backend/database — running in parallel would let them interfere with each other's data
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      cwd: '../frontend',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
