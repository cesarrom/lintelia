/**
 * The suite's `test` and `expect`: Playwright's, plus the visual mode (support/visual). Specs import from here instead
 * of '@playwright/test' so every browser a test opens can be watched when the machine has a screen.
 *
 * With visual mode off (headless: CI, no display, E2E_VISUAL=0) these fixtures do nothing.
 */
import { test as base, expect } from '@playwright/test';
import { instrumentBrowser, visual, visualTestStarted } from './visual/runtime';

export const test = base.extend<{ _visualTest: void }>({
  // The worker's browser, instrumented so that every context it creates (page fixture, persona contexts opened in
  // beforeAll hooks, portals…) is tiled on the screen and shows the overlay.
  browser: [
    async ({ browser }, use) => {
      instrumentBrowser(browser);
      await use(browser);
    },
    { scope: 'worker' },
  ],
  // Highlighting each action before it runs takes time: give watched tests more of it.
  _visualTest: [
    async ({}, use, testInfo) => {
      if (visual.enabled && testInfo.project.name === 'ui' && testInfo.timeout > 0) testInfo.setTimeout(testInfo.timeout * 2);
      // Close the windows left open by the previous spec file of this worker.
      await visualTestStarted();
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Browser, BrowserContext, FrameLocator, Locator, Page } from '@playwright/test';
