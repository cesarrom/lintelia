import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite: persona flows from docs/product/flows.md, tagged with their flow id (e.g. @FIA-04).
 * Many tests describe behaviour that is not built yet and fail on purpose; `bun run flow-status` summarises which
 * flows pass. See docs/testing/e2e.md.
 *
 *  - project `api`: HTTP-level flows (authorization, contracts, scenarios driven through the API)
 *  - project `ui`:  browser journeys (Chromium)
 */
const startStack = !!process.env.E2E_START_STACK;

export default defineConfig({
  testDir: './tests',
  // Files run in parallel; tests inside a file run in order and share the institution created in beforeAll.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './support/global-setup.ts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    // Fail fast when a UI element does not exist yet (most UI flows are planned) instead of waiting for the test timeout.
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testMatch: /.*\.api\.spec\.ts$/ },
    {
      name: 'ui',
      testMatch: /.*\.ui\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: startStack
    ? [
      // The whole local stack (scripts/stack.ts): databases, Restate, API, web, connectors and fake vendors.
      { command: 'bun scripts/stack.ts up --profile e2e', cwd: '../..', url: 'http://localhost:8000/health', reuseExistingServer: true, timeout: 300_000 },
      { command: 'true', url: 'http://localhost:3001', reuseExistingServer: true, timeout: 300_000 },
    ]
    : undefined,
});
