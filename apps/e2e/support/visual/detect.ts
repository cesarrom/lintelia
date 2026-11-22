/**
 * Visual mode of the e2e suite: when this machine can show a browser window, the UI journeys run in a real (headed)
 * Chromium that a person can watch — windows tiled on the screen, one per persona, with an overlay that says which
 * test is running, who is signed in and what the test is about to do (see docs/testing/e2e.md §Watching the tests).
 *
 * `resolveVisual()` runs in the Playwright runner when the config loads. It decides once per run and hands the
 * decision to the workers through an environment variable, so the (short) headed probe is not repeated per worker.
 *
 *   E2E_VISUAL=auto (default) | 1 | 0     auto: headed when a display and a browser with a UI are available
 *   E2E_VISUAL_DELAY=350                  ms the target of each action stays highlighted before the action runs
 *   E2E_VISUAL_SLOWMO=120                 Playwright slowMo: ms after each click/check/select (see the result)
 *   E2E_VISUAL_WORKERS=1                  UI tests at the same time (API tests keep E2E_WORKERS)
 *   E2E_VISUAL_SCALE=0.5 / E2E_VISUAL_GRID=2x2    window scale and tiling (default: fit 4 windows on the screen)
 *   E2E_VISUAL_HUD=0                      no overlay in the pages (windows only)
 *   E2E_VISUAL_MONITOR=0                  no run monitor window (progress of every test, API tests included)
 *   E2E_CHROMIUM_PATH=/path/to/chrome     browser to use (default: Playwright's Chromium, else an installed Chrome)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';

export interface ScreenInfo {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  availLeft: number;
  availTop: number;
  dpr: number;
}

export interface VisualSettings {
  enabled: boolean;
  /** Why visual mode is on or off (printed once at the start of the run). */
  reason: string;
  runId: string;
  /** Browser used for the headed run; undefined = Playwright's bundled Chromium. */
  executablePath?: string;
  browserLabel?: string;
  screen?: ScreenInfo;
  /** Windows are drawn at this fraction of their size; pages still see the same 1280×720 CSS viewport. */
  scale: number;
  /** Outer size of a browser window showing the whole viewport, in device-independent pixels. */
  window: { width: number; height: number };
  grid: { cols: number; rows: number };
  /** UI tests that run at the same time; each gets its own part of the grid ("lane"). */
  uiWorkers: number;
  delay: number;
  slowMo: number;
  hud: boolean;
  /** A live run monitor (monitor.ts) takes the last tile of the grid; the browser tests use the others. */
  monitor: boolean;
}

const ENV_KEY = 'E2E_VISUAL_RESOLVED';
/** The viewport of the `ui` project (devices['Desktop Chrome']); visual mode never changes it. */
export const VIEWPORT = { width: 1280, height: 720 };
/**
 * What a window adds around the page (frame, tab strip, toolbar; on Linux also the shadow margins of Chromium's own
 * window decorations), in device-independent pixels, when the probe cannot tell. Playwright assumes 8×85 on Linux,
 * which cuts ~44 px off the bottom of the page under a compositing window manager: the stage sets the real size.
 */
const DEFAULT_INSETS = { width: 32, height: 129 };

const truthy = (v?: string) => !!v && /^(1|true|yes|on|headed)$/i.test(v.trim());
const falsy = (v?: string) => !!v && /^(0|false|no|off|headless)$/i.test(v.trim());
const num = (v: string | undefined, fallback: number) => (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Installed Chrome / Chromium / Edge builds with a UI, in order of preference. */
function systemBrowsers(): Array<{ path: string; label: string }> {
  const candidates: Array<[string, string]> =
    process.platform === 'darwin'
      ? [
        ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'],
        ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'],
        ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Microsoft Edge'],
      ]
      : process.platform === 'win32'
        ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).flatMap((base): Array<[string, string]> => [
          [join(base!, 'Google/Chrome/Application/chrome.exe'), 'Google Chrome'],
          [join(base!, 'Microsoft/Edge/Application/msedge.exe'), 'Microsoft Edge'],
        ])
        : [
          ['/opt/google/chrome/chrome', 'Google Chrome'],
          ['/usr/bin/google-chrome-stable', 'Google Chrome'],
          ['/usr/bin/google-chrome', 'Google Chrome'],
          ['/usr/bin/chromium', 'Chromium'],
          ['/usr/bin/chromium-browser', 'Chromium'],
          ['/snap/bin/chromium', 'Chromium (snap)'],
          ['/usr/bin/microsoft-edge', 'Microsoft Edge'],
        ];
  return candidates.filter(([path]) => existsSync(path)).map(([path, label]) => ({ path, label }));
}

/** Browsers that can open a window, best first. Playwright's headless shell cannot, so it is never a candidate. */
function headedBrowsers(): Array<{ executablePath?: string; label: string }> {
  const list: Array<{ executablePath?: string; label: string }> = [];
  if (process.env.E2E_CHROMIUM_PATH) list.push({ executablePath: process.env.E2E_CHROMIUM_PATH, label: process.env.E2E_CHROMIUM_PATH });
  try {
    if (existsSync(chromium.executablePath())) list.push({ label: `Playwright Chromium (${chromium.executablePath()})` });
  } catch {
    // Not installed for this Playwright version.
  }
  for (const b of systemBrowsers()) list.push({ executablePath: b.path, label: `${b.label} (${b.path})` });
  return list;
}

/** Is there a screen to draw on? (Windows and macOS desktops always have one; Linux needs X11 or Wayland.) */
function displayAvailable(): { ok: boolean; detail: string } {
  if (process.platform === 'win32' || process.platform === 'darwin') return { ok: true, detail: 'desktop session' };
  if (process.env.WAYLAND_DISPLAY) return { ok: true, detail: `WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY}` };
  const display = process.env.DISPLAY;
  if (!display) return { ok: false, detail: 'no DISPLAY or WAYLAND_DISPLAY' };
  // Local X servers listen on /tmp/.X11-unix/X<n>; remote ones (host:n, SSH forwarding) are left to the probe.
  const local = /^:(\d+)/.exec(display);
  if (local && !existsSync(`/tmp/.X11-unix/X${local[1]}`)) return { ok: false, detail: `DISPLAY=${display} but no X server socket` };
  return { ok: true, detail: `DISPLAY=${display}` };
}

type ProbeResult = { ok: true; screen: ScreenInfo; insets?: { width: number; height: number } } | { ok: false; error: string };

function probe(browser: { executablePath?: string }): ProbeResult {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, 'probe.mjs'), JSON.stringify(browser)], {
    encoding: 'utf8',
    timeout: 30_000,
    env: process.env,
  });
  const line = result.stdout?.trim().split('\n').pop();
  try {
    return JSON.parse(line ?? '');
  } catch {
    return { ok: false, error: (result.stderr || result.error?.message || 'probe failed').trim().split('\n')[0] };
  }
}

/**
 * Largest window scale at which `slots` windows tile the work area without overlapping.
 * Windows keep their 1280×720 viewport: only their on-screen size changes.
 */
export function fitGrid(area: { width: number; height: number }, win: { width: number; height: number }, slots: number) {
  let best = { cols: 1, rows: 1, scale: 0 };
  for (let cols = 1; cols <= slots; cols++) {
    const rows = Math.ceil(slots / cols);
    const scale = Math.min(1, area.width / (cols * win.width), area.height / (rows * win.height));
    if (scale > best.scale + 0.001) best = { cols, rows, scale };
  }
  return best;
}

function layout(screen: ScreenInfo, win: { width: number; height: number }, uiWorkers: number) {
  const area = { width: screen.availWidth, height: screen.availHeight };
  const grid = /^(\d+)x(\d+)$/i.exec(process.env.E2E_VISUAL_GRID ?? '');
  let fit = grid ? { cols: Number(grid[1]), rows: Number(grid[2]), scale: 0 } : fitGrid(area, win, Math.max(4, uiWorkers));
  // Below ~40% text gets hard to read: fewer, larger windows (they overlap, the active one is raised) beat tiny ones.
  if (!grid && fit.scale < 0.4) fit = fitGrid(area, win, Math.max(1, uiWorkers));
  const fitted = Math.min(1, area.width / (fit.cols * win.width), area.height / (fit.rows * win.height));
  const scale = Math.round(Math.min(1, Math.max(0.25, num(process.env.E2E_VISUAL_SCALE, Math.max(fitted, 0.4)))) * 1000) / 1000;
  return { grid: { cols: fit.cols, rows: fit.rows }, scale };
}

function selectedProjectsIncludeUi(argv: string[]) {
  const projects: string[] = [];
  argv.forEach((arg, i) => {
    if (arg === '--project' && argv[i + 1]) projects.push(argv[i + 1]);
    else if (arg.startsWith('--project=')) projects.push(arg.slice('--project='.length));
  });
  return !projects.length || projects.some((p) => p.split(',').includes('ui'));
}

function decide(argv: string[]): VisualSettings {
  const uiWorkers = Math.max(1, num(process.env.E2E_VISUAL_WORKERS, 1));
  const base: VisualSettings = {
    enabled: false,
    reason: '',
    runId: `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`,
    scale: 1,
    window: { width: VIEWPORT.width + DEFAULT_INSETS.width, height: VIEWPORT.height + DEFAULT_INSETS.height },
    grid: { cols: 1, rows: 1 },
    uiWorkers,
    delay: Math.max(0, num(process.env.E2E_VISUAL_DELAY, 350)),
    slowMo: Math.max(0, num(process.env.E2E_VISUAL_SLOWMO, 120)),
    hud: !falsy(process.env.E2E_VISUAL_HUD),
    monitor: false,
  };
  const off = (reason: string): VisualSettings => ({ ...base, reason });
  const setting = process.env.E2E_VISUAL ?? 'auto';
  const forced = truthy(setting) || argv.includes('--headed');

  if (falsy(setting)) return off('E2E_VISUAL=0');
  if (argv[0] !== 'test' && argv[0] !== undefined) return off(`not a test run (${argv[0]})`);
  if (argv.includes('--ui') || argv.includes('--debug')) return off('Playwright UI/debug mode has its own browser view');
  if (!selectedProjectsIncludeUi(argv)) return off('no browser tests selected (api project only)');
  if (!forced && process.env.CI) return off('CI environment (set E2E_VISUAL=1 to force)');

  const display = displayAvailable();
  if (!display.ok) return off(display.detail);

  const browsers = headedBrowsers();
  if (!browsers.length) return off('no browser with a UI found (bunx playwright install chromium, or set E2E_CHROMIUM_PATH)');
  const failures: string[] = [];
  for (const browser of browsers) {
    const result = probe(browser);
    if (!result.ok) {
      failures.push(`${browser.label}: ${result.error}`);
      continue;
    }
    const insets = result.insets ?? DEFAULT_INSETS;
    const window = { width: VIEWPORT.width + insets.width, height: VIEWPORT.height + insets.height };
    const { grid, scale } = layout(result.screen, window, uiWorkers);
    // The monitor needs a tile of its own, with at least one tile left per UI worker.
    const monitor = !falsy(process.env.E2E_VISUAL_MONITOR) && grid.cols * grid.rows > uiWorkers;
    return {
      ...base,
      enabled: true,
      reason: `${display.detail}, ${result.screen.availWidth}×${result.screen.availHeight} work area`,
      executablePath: browser.executablePath,
      browserLabel: browser.label,
      screen: result.screen,
      window,
      grid,
      scale,
      monitor,
    };
  }
  return off(`could not open a browser window (${failures.join('; ')})`);
}

const isWorker = () => process.env.TEST_WORKER_INDEX !== undefined;

/** Detect without caching or printing (e.g. `bun run stack:doctor`). */
export function detectVisual(): VisualSettings {
  return decide(['test']);
}

/**
 * The decision for a run with these Playwright arguments (`bun e2e` decides before starting Playwright and hands it
 * over with `E2E_VISUAL_RESOLVED`, so the probe runs once).
 */
export function decideVisual(playwrightArgs: string[]): VisualSettings {
  return decide(['test', ...playwrightArgs]);
}

export const VISUAL_DECISION_ENV = ENV_KEY;

/** The decision for this run (computed in the runner, read back from the environment in the workers). */
export function resolveVisual(): VisualSettings {
  const cached = process.env[ENV_KEY];
  if (cached) return JSON.parse(cached);
  const settings = decide(process.argv.slice(2));
  process.env[ENV_KEY] = JSON.stringify(settings);
  if (!isWorker()) printBanner(settings);
  if (!settings.enabled && truthy(process.env.E2E_VISUAL)) {
    throw new Error(`E2E_VISUAL=1 but the browser tests cannot run headed: ${settings.reason}`);
  }
  return settings;
}

function printBanner(s: VisualSettings) {
  const dim = (t: string) => (process.stdout.isTTY ? `\x1b[2m${t}\x1b[0m` : t);
  const bold = (t: string) => (process.stdout.isTTY ? `\x1b[1m${t}\x1b[0m` : t);
  if (!s.enabled) {
    console.log(dim(`e2e visual mode: off — ${s.reason}. Browser tests run headless.`));
    return;
  }
  console.log(
    `${bold('e2e visual mode: on')} — browser tests run in visible windows (${s.reason}).\n` +
    dim(`  browser ${s.browserLabel}\n`) +
    dim(`  ${s.grid.cols}×${s.grid.rows} tiles at ${Math.round(s.scale * 100)}% · ${s.uiWorkers} UI test(s) at a time · ` +
      `${s.delay} ms highlight before each action · slowMo ${s.slowMo} ms${s.hud ? ' · overlay on' : ''}` +
      `${s.monitor ? ' · run monitor in the last tile' : ''}\n`) +
    dim('  E2E_VISUAL=0 runs headless; E2E_VISUAL_DELAY / _SLOWMO / _WORKERS / _SCALE / _GRID tune it (docs/testing/e2e.md).'),
  );
}

/** Chromium flags for a visual run: windows drawn at `scale` (the page still sees its full CSS viewport). */
export function visualLaunchArgs(s: VisualSettings) {
  if (!s.enabled) return [];
  const dpr = s.screen?.dpr ?? 1;
  return [
    `--force-device-scale-factor=${Math.round(s.scale * dpr * 1000) / 1000}`,
    // Park new windows out of the way until the stage places them (avoids a flash over the previous test).
    '--window-position=0,0',
  ];
}
