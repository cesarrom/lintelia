/**
 * Worker side of the e2e visual mode (see detect.ts for when it is on). For every browser context the tests create
 * (the `page` fixture, `browser.newContext()` in persona helpers, beforeAll hooks…) it:
 *
 *  - injects the overlay (overlay.ts) and the binding it talks to;
 *  - places each window in a tile of the screen ("stage"), so every persona of a journey is visible at once;
 *  - brings the window where something happens to the front;
 *  - before each user-like action (click, fill, check, select, press, upload…) highlights the target with
 *    Playwright's own locator highlight and waits E2E_VISUAL_DELAY ms, so a person can follow what is about to happen.
 *
 * Nothing here changes what a test does or sees: viewport, locators, timing of assertions and the DOM the app owns
 * are untouched. Calls made only for the show are marked internal, so they stay out of reports and traces.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { resolveVisual, type VisualSettings } from './detect';
import { installOverlay, VISUAL_BINDING } from './overlay';

export const visual: VisualSettings = resolveVisual();

const SESSION_KEY = 'lintelia.session';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` as an internal Playwright call (not reported as a test step), when the client supports it. */
function internal<T>(owner: unknown, fn: () => Promise<T>): Promise<T> {
  const wrap = (owner as { _wrapApiCall?: (f: () => Promise<T>, o: { internal: boolean }) => Promise<T> })?._wrapApiCall;
  return typeof wrap === 'function' ? wrap.call(owner, fn, { internal: true }) : fn();
}

// --- what the overlay shows ------------------------------------------------------------------------------------------

const show: { step: string; testId: string; target?: { page: Page; box: { x: number; y: number; width: number; height: number } } } = { step: '', testId: '' };

function currentTest() {
  try {
    const info = base.info();
    if (info.testId !== show.testId) {
      show.testId = info.testId;
      show.step = '';
    }
    const hook = (info as unknown as { _currentHookType?: () => string | undefined })._currentHookType?.();
    const path = info.titlePath.slice(0, -1);
    path[0] = path[0]?.replace(/^.*tests[\\/]/, '');
    return { title: info.title, where: path.join(' › '), phase: hook ?? 'test' };
  } catch {
    return { title: '', where: '', phase: '' };
  }
}

// --- stage: tiles of the screen for this worker's windows ----------------------------------------------------------

interface Rect { x: number; y: number; width: number; height: number; row: number }

class Stage {
  private lane: number | undefined;
  private cells: Rect[] = [];
  private readonly occupied = new Map<Page, number>();
  private overflow = 0;
  active: Page | undefined;

  constructor(private readonly settings: VisualSettings) { }

  /** Each UI worker claims a lane (its share of the tiles) with a lock file for the duration of the run. */
  private claimLane() {
    const dir = join(tmpdir(), 'lintelia-e2e-visual', this.settings.runId);
    mkdirSync(dir, { recursive: true });
    const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (let attempt = 0; attempt < 2; attempt++) {
      for (let lane = 0; lane < this.settings.uiWorkers; lane++) {
        const file = join(dir, `lane-${lane}`);
        try {
          writeFileSync(file, String(process.pid), { flag: 'wx' });
          process.once('exit', () => rmSync(file, { force: true }));
          return lane;
        } catch {
          // Taken. A worker that crashed leaves its lock behind: take the lane over on the second pass.
          if (attempt === 1 && !alive(Number(readFileSync(file, 'utf8')))) {
            rmSync(file, { force: true });
            lane--;
          }
        }
      }
    }
    return Number(process.env.TEST_PARALLEL_INDEX ?? 0) % this.settings.uiWorkers;
  }

  private setup() {
    if (this.lane !== undefined) return;
    this.lane = this.claimLane();
    const screen = this.settings.screen!;
    const { cols, rows } = this.settings.grid;
    const width = screen.availWidth / cols;
    const height = screen.availHeight / rows;
    const all: Rect[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) all.push({ x: screen.availLeft + c * width, y: screen.availTop + r * height, width, height, row: r });
    }
    // The last tile belongs to the run monitor (monitor.ts) when it is on.
    if (this.settings.monitor && all.length > 1) all.pop();
    const lanes = this.settings.uiWorkers;
    this.cells = lanes > 1 && all.length >= lanes ? all.filter((_, i) => i % lanes === this.lane) : all;
    if (lanes > all.length) this.cells = [all[this.lane % all.length]];
  }

  get laneLabel() {
    return this.settings.uiWorkers > 1 && this.lane !== undefined ? String(this.lane + 1) : '';
  }

  get windows() {
    return this.occupied.size;
  }

  async place(page: Page) {
    this.setup();
    const used = new Set(this.occupied.values());
    let index = this.cells.findIndex((_, i) => !used.has(i));
    let cascade = 0;
    if (index < 0) {
      // More windows than tiles: stack them with an offset; the one in use is brought to the front. Not in the
      // monitor's row, where a sideways offset would cover it.
      const lastRow = this.settings.grid.rows - 1;
      const stackable = this.cells.map((_, i) => i).filter((i) => !(this.settings.monitor && this.cells[i].row === lastRow && lastRow > 0));
      const pool = stackable.length ? stackable : this.cells.map((_, i) => i);
      index = pool[this.overflow % pool.length];
      cascade = 1 + Math.floor(this.overflow / pool.length);
      this.overflow++;
    }
    this.occupied.set(page, index);
    page.once('close', () => {
      this.occupied.delete(page);
      if (this.active === page) this.active = undefined;
      if (!this.occupied.size) this.overflow = 0;
    });
    const cell = this.cells[index];
    const scale = this.settings.scale;
    const { width, height } = this.settings.window;
    // Centre the window in its tile (window bounds are in device-independent pixels: logical px / scale). Extra
    // windows cascade sideways, towards the middle of the screen: never down into the tile below (the monitor's).
    const screen = this.settings.screen!;
    const towardsCentre = cell.x + cell.width / 2 < screen.availLeft + screen.availWidth / 2 ? 1 : -1;
    const offset = (cascade % 5) * 36 * towardsCentre;
    const left = Math.round((cell.x + Math.max(0, (cell.width - width * scale) / 2) + offset) / scale);
    const top = Math.round((cell.y + Math.max(0, (cell.height - height * scale) / 2)) / scale);
    await internal(page, async () => {
      const cdp = await page.context().newCDPSession(page);
      try {
        const { windowId } = await cdp.send('Browser.getWindowForTarget');
        await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
        // Also the size: the whole viewport must show (Playwright's guess of the window frame is too small on Linux).
        await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left, top, width, height } });
      } finally {
        await cdp.detach().catch(() => { });
      }
    }).catch(() => { /* the page closed meanwhile, or the browser cannot move windows */ });
  }

  raise(page: Page) {
    if (this.active === page || page.isClosed()) return;
    this.active = page;
    void internal(page, () => page.bringToFront()).catch(() => { });
  }
}

// --- instrumentation -----------------------------------------------------------------------------------------------

const instrumented = new WeakSet<object>();
let stage: Stage | undefined;

/**
 * Contexts by the spec file that created them. Persona contexts opened in beforeAll hooks are never closed by the
 * specs (headless, they just live until the worker exits); on screen they would pile up across files. When a file
 * starts, the windows of the files before it are closed — their afterAll hooks have run by then, since a worker runs
 * one file at a time.
 */
const contextFiles = new Map<BrowserContext, string>();

function currentFile() {
  try {
    return base.info().file;
  } catch {
    return undefined;
  }
}

async function closeOtherFiles(file: string | undefined) {
  if (!file) return;
  const stale = [...contextFiles].filter(([, f]) => f !== file).map(([context]) => context);
  for (const context of stale) contextFiles.delete(context);
  await Promise.all(stale.map((context) => internal(context, () => context.close()).catch(() => { })));
}

/** Called at the start of every test (support/test.ts). */
export async function visualTestStarted() {
  if (visual.enabled) await closeOtherFiles(currentFile());
}

/** Locator methods that act like a person; each is previewed (window raised, target highlighted, short pause). */
const ACTIONS: Record<string, string> = {
  click: 'Click', dblclick: 'Double-click', tap: 'Tap', hover: 'Hover', fill: 'Fill', type: 'Type',
  pressSequentially: 'Type', press: 'Press', check: 'Check', uncheck: 'Uncheck', selectOption: 'Select',
  setInputFiles: 'Upload', selectText: 'Select text', dragTo: 'Drag',
};

function describeAction(verb: string, locator: Locator, args: unknown[]) {
  const target = String(locator);
  const first = args[0];
  const secret = /pass(word)?|secret|code/i.test(target);
  let detail = '';
  if ((verb === 'Fill' || verb === 'Type') && typeof first === 'string') detail = secret ? ' "••••"' : ` ${JSON.stringify(first.length > 60 ? `${first.slice(0, 57)}…` : first)}`;
  else if (verb === 'Press' && typeof first === 'string') detail = ` ${first}`;
  else if (verb === 'Select' && first !== undefined) detail = ` ${JSON.stringify(first)}`;
  return `${verb} ${target}${detail}`;
}

async function preview(locator: Locator, title: string, hiddenTarget = false) {
  show.step = title;
  show.target = undefined;
  const page = locator.page();
  stage?.raise(page);
  if (visual.delay <= 0) return;
  const frame = (locator as unknown as { _frame?: unknown })._frame ?? page;
  await internal(frame, async () => {
    // Wait (briefly) for the target so the highlight lands on it; the action itself still auto-waits as usual.
    await locator.waitFor({ state: hiddenTarget ? 'attached' : 'visible', timeout: 3000 }).catch(() => { });
    await locator.highlight().catch(() => { });
    // Where it is, so the overlay can move out of the way.
    const box = await locator.boundingBox({ timeout: 500 }).catch(() => null);
    if (box) show.target = { page, box };
  }).catch(() => { });
  await sleep(visual.delay);
}

let patched = false;
/** Locators inside a previewed action: pressSequentially → type, clear → fill… are shown once. */
const acting = new WeakSet<object>();

function patchPrototypes(page: Page) {
  if (patched) return;
  patched = true;
  const locatorProto = Object.getPrototypeOf(page.locator('html')) as Record<string, unknown>;
  for (const [method, verb] of Object.entries(ACTIONS)) {
    const original = locatorProto[method] as ((...a: unknown[]) => Promise<unknown>) | undefined;
    if (typeof original !== 'function') continue;
    locatorProto[method] = async function (this: Locator, ...args: unknown[]) {
      if (acting.has(this)) return original.apply(this, args);
      acting.add(this);
      try {
        // File inputs are usually hidden behind a styled button: do not wait for them to become visible.
        await preview(this, describeAction(verb, this, args), method === 'setInputFiles');
        return await original.apply(this, args);
      } finally {
        acting.delete(this);
      }
    };
  }
  const pageProto = Object.getPrototypeOf(page) as Record<string, unknown>;
  for (const method of ['goto', 'reload', 'goBack'] as const) {
    const original = pageProto[method];
    if (typeof original !== 'function') continue;
    pageProto[method] = async function (this: Page, ...args: unknown[]) {
      show.step = method === 'goto' ? `Open ${String(args[0])}` : method === 'reload' ? 'Reload' : 'Back';
      stage?.raise(this);
      return (original as (...a: unknown[]) => Promise<unknown>).apply(this, args);
    };
  }
}

async function instrumentContext(context: BrowserContext) {
  if (instrumented.has(context)) return;
  instrumented.add(context);
  const file = currentFile();
  await closeOtherFiles(file);
  if (file) {
    contextFiles.set(context, file);
    context.once('close', () => contextFiles.delete(context));
  }
  await internal(context, async () => {
    await context.exposeBinding(VISUAL_BINDING, ({ page }, command: string) => {
      if (command === 'active') {
        if (page) stage?.raise(page);
        return null;
      }
      return {
        ...currentTest(),
        step: show.step,
        lane: stage?.laneLabel ?? '',
        active: !!page && stage?.active === page,
        target: page && show.target?.page === page ? show.target.box : undefined,
        windows: stage?.windows ?? 0,
      };
    });
    await context.addInitScript(installOverlay, {
      binding: VISUAL_BINDING,
      hud: visual.hud,
      sessionKey: SESSION_KEY,
      // Windows drawn at 50% would make 12 px text 6 px on screen: compensate, within reason.
      textScale: Math.min(1.7, Math.max(1, 0.85 / visual.scale)),
    });
  });
  const onPage = (page: Page) => {
    patchPrototypes(page);
    void stage?.place(page);
  };
  context.on('page', onPage);
  for (const page of context.pages()) onPage(page);
}

/** Wrap the worker's browser so every context it creates is instrumented (no-op when visual mode is off). */
export function instrumentBrowser(browser: Browser) {
  if (!visual.enabled || instrumented.has(browser)) return;
  instrumented.add(browser);
  stage ??= new Stage(visual);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args: Parameters<Browser['newContext']>) => {
    const context = await newContext(...args);
    await instrumentContext(context);
    return context;
  };
}
