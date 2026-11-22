# 0005 — Watching the e2e tests (visual mode)

When the machine can show a browser window, the browser journeys of the e2e suite now run headed and arranged so a
person can follow them; otherwise the suite runs headless exactly as before. How to use and tune it:
[../testing/e2e.md §Watching the tests](../testing/e2e.md#watching-the-tests).

## What changed

- **Detection** (`apps/e2e/support/visual/detect.ts`, `probe.mjs`): decided once per run in the Playwright runner,
  printed first, handed to the workers through `E2E_VISUAL_RESOLVED`. Off for CI, non-`test` commands, `--ui`/`--debug`,
  api-only runs, no display (Linux: no `DISPLAY`/`WAYLAND_DISPLAY`, or no X socket), no browser with a UI, or when a
  real headed launch (off-screen probe) fails. `E2E_VISUAL=1` insists and fails with the reason; `E2E_VISUAL=0` never.
  Browser order: `E2E_CHROMIUM_PATH`, Playwright's Chromium, installed Chrome/Chromium/Edge.
- **Windows** (`runtime.ts`): every context a test creates is instrumented (the `browser` fixture is wrapped, so the
  `page` fixture, persona contexts and beforeAll hooks are all covered). Windows are tiled (default 2×2 fitted to the
  work area) with Chromium's `--force-device-scale-factor`, so pages keep their 1280×720 CSS viewport; overflow
  windows cascade; the window where something happens is brought to the front. Each UI worker claims a lane of tiles
  with a lock file.
- **Narration**: before each person-like action the target is highlighted (`locator.highlight()`) for
  `E2E_VISUAL_DELAY` ms; Playwright `slowMo` after clicks. An overlay (`overlay.ts`, closed shadow root outside
  `<body>`, `pointer-events: none`, CSSOM styles) shows a cursor, click ripples, field glows, and in the active window
  a HUD with spec, test, step and persona (the other windows: persona only). The HUD moves away from the target.
- **Run monitor** (`monitor.ts`, `monitor-page.ts`): a reporter that opens an app window in the last tile with the
  progress of the whole run over Server-Sent Events — per-worker current test and step (API tests included), results,
  pinned failures.
- Specs import `test`/`expect` from `apps/e2e/support/test.ts` (all 54 spec files switched); watched UI tests get
  twice their timeout; `ui` project workers default to 1 in visual mode (`E2E_VISUAL_WORKERS`).
- Scripts: `bun run e2e:watch`, `bun run e2e:headless` (and `test:watch` / `test:headless` in `apps/e2e`);
  `bun run stack:doctor` reports whether browser tests would run headed and why.
- Playwright sizes headed windows with fixed insets (8×85 on Linux), which cut ~44 px off the bottom of every page
  under a compositing window manager (Chromium draws its own frame with shadow margins). The probe measures the
  real insets and the stage sets the window size, so the whole viewport is visible.
- Windows of previous spec files are closed when a worker starts the next file: persona contexts opened in
  beforeAll hooks are never closed by the specs, and piled up on screen (headless they live, unseen, until the
  worker exits).
- Suite hygiene found on the way: `staff-management.api.spec.ts` created an institution named "x" on every run and
  never removed it (it now offboards it); `platform-console.ui.spec.ts` (STAFF-05) picked an institution from a
  dropdown whose options change while other workers create and delete institutions, and failed once in a headless
  full run when the click missed (it now picks again until the choice shows).
- `bun.lock`: dropped the stale `@complycube/api` entry (ComplyCube was removed in 0004); `bun install
  --frozen-lockfile` failed on it.

## Verified

- Full suite headless before the change: 404 passed (5.8 min, 4 workers).
- Full suite in visual mode on Linux/X11 (Xvfb 1400×850 + mutter, Playwright Chromium 1208): 404 passed in
  7.7 min (UI tests one at a time, API tests alongside on 3 workers), recorded from the screen and inspected. A first
  version took 15.8 min: the overlay's backdrop blur and endless animations are expensive in software rendering, and
  it polled every 200 ms from every window; now no blur, no endless animations, and slow polling outside the window
  in use.
- Decision paths checked with `playwright test --list`: no `DISPLAY`, a `DISPLAY` without an X server, `CI=1`,
  `CI=1 E2E_VISUAL=1`, `E2E_VISUAL=0`, `--project=api`, and `E2E_VISUAL=1` without a display (fails with the reason).
- Not verified here: macOS and Windows (same Chromium/CDP code paths; `--force-device-scale-factor` behaviour on
  macOS in particular), Wayland-only sessions.

## Not done / next

- Modernising the web app's UI and a screen builder for end-user registration and self-service (the next goals).
- The download bubble of headed Chromium can cover a page corner briefly after a download (tests are unaffected;
  suppressing it would mean overriding Playwright's own `--disable-features` list).
