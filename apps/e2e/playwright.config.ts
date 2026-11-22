import { defineConfig, devices } from '@playwright/test';
import { resolveVisual, visualLaunchArgs } from './support/visual/detect';

/**
 * End-to-end suite: persona flows from docs/product/flows.md, tagged with their flow id (e.g. @FIA-04).
 * Many tests describe behaviour that is not built yet and fail on purpose; `bun run flow-status` summarises which
 * flows pass. See docs/testing/e2e.md.
 *
 *  - project `api`: HTTP-level flows (authorization, contracts, scenarios driven through the API)
 *  - project `ui`:  browser journeys (Chromium)
 *
 * Visual mode (support/visual): when the machine can show a browser window (a desktop session, or DISPLAY /
 * WAYLAND_DISPLAY on Linux, and a Chromium or Chrome with a UI), the `ui` project runs headed, one test at a time,
 * with windows tiled on the screen and an overlay that narrates each step, so a person can watch the journeys.
 * Otherwise (CI, no display, E2E_VISUAL=0) it runs headless exactly as before. The decision is printed at the start.
 */
const startStack = !!process.env.E2E_START_STACK;
const visual = resolveVisual();

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
    // Visual mode only: a window with the live progress of the whole run (support/visual/monitor.ts).
    ['./support/visual/monitor.ts'],
  ],
  use: {
    // Fail fast when a UI element does not exist yet (most UI flows are planned) instead of waiting for the test timeout.
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testMatch: /.*\.api\.spec\.ts$/ },
    // `E2E_DEMO=1`: the sales-material stories (tests/demo), recorded by demo/record.sh. Absent from normal runs.
    ...(process.env.E2E_DEMO === '1'
      ? [{
        name: 'demo',
        testMatch: '**/demo/**/*.demo.spec.ts',
        timeout: 480_000,
        use: { ...devices['Desktop Chrome'], launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {} },
      }]
      : []),
    {
      name: 'ui',
      testMatch: /.*\.ui\.spec\.ts$/,
      // Watched runs show one journey at a time (E2E_VISUAL_WORKERS); API tests keep running alongside.
      ...(visual.enabled ? { workers: visual.uiWorkers } : {}),
      use: {
        ...devices['Desktop Chrome'],
        headless: !visual.enabled,
        launchOptions: visual.enabled
          ? {
            ...(visual.executablePath ? { executablePath: visual.executablePath } : {}),
            slowMo: visual.slowMo,
            args: visualLaunchArgs(visual),
          }
          : process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
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
