/**
 * Live run monitor of the e2e visual mode: a Playwright reporter that, when visual mode is on, opens one more window
 * (in the last tile of the screen) showing the whole run as it happens — progress, what every worker is running
 * right now with its latest step, and results as they come in (failures stay pinned). Browser journeys can be watched
 * in their own windows; API tests (most of the suite) have no window, and this is where they show.
 *
 * It runs in the Playwright runner, serves a small page on 127.0.0.1 (random port) and pushes updates with
 * Server-Sent Events. With visual mode off, or E2E_VISUAL_MONITOR=0, it does nothing.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext } from '@playwright/test';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { resolveVisual } from './detect';
import { monitorPage } from './monitor-page';

interface Running {
  id: string;
  project: string;
  file: string;
  where: string;
  title: string;
  step: string;
  startedAt: number;
  worker: number;
}

interface Finished {
  id: string;
  project: string;
  file: string;
  title: string;
  status: TestResult['status'] | 'flaky';
  duration: number;
  error?: string;
  at: number;
}

export interface MonitorState {
  startedAt: number;
  total: number;
  counts: { passed: number; failed: number; skipped: number; flaky: number; done: number };
  running: Running[];
  recent: Finished[];
  failures: Finished[];
  finished?: { status: FullResult['status']; duration: number };
}

const MAX_RECENT = 40;
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

function where(test: TestCase) {
  const path = test.titlePath().filter(Boolean);
  // [project, file, ...describes, title]
  return path.slice(2, -1).join(' › ');
}

const fileOf = (test: TestCase) => test.location.file.replace(/^.*[\\/]tests[\\/]/, '');

export default class MonitorReporter implements Reporter {
  private readonly settings = resolveVisual();
  private readonly on = this.settings.enabled && this.settings.monitor;
  private state: MonitorState = {
    startedAt: Date.now(),
    total: 0,
    counts: { passed: 0, failed: 0, skipped: 0, flaky: 0, done: 0 },
    running: [],
    recent: [],
    failures: [],
  };
  private readonly running = new Map<string, Running>();
  private readonly clients = new Set<ServerResponse>();
  private server?: Server;
  private window?: Promise<BrowserContext | undefined>;
  private profileDir?: string;
  private flushTimer?: NodeJS.Timeout;

  printsToStdio() {
    return false;
  }

  onBegin(_config: FullConfig, suite: Suite) {
    if (!this.on) return;
    this.state.total = suite.allTests().length;
    this.state.startedAt = Date.now();
    this.window = this.open().catch((error) => {
      console.warn(`e2e run monitor: could not open its window (${(error as Error).message.split('\n')[0]})`);
      return undefined;
    });
  }

  onTestBegin(test: TestCase, result: TestResult) {
    if (!this.on) return;
    const entry: Running = {
      id: `${test.id}:${result.retry}`,
      project: test.parent.project()?.name ?? '',
      file: fileOf(test),
      where: where(test),
      title: test.title,
      step: '',
      startedAt: Date.now(),
      worker: result.parallelIndex,
    };
    this.running.set(entry.id, entry);
    this.changed();
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (!this.on || !['pw:api', 'test.step', 'expect'].includes(step.category)) return;
    const entry = this.running.get(`${test.id}:${result.retry}`);
    if (!entry) return;
    entry.step = step.title;
    this.changed();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!this.on) return;
    const id = `${test.id}:${result.retry}`;
    this.running.delete(id);
    const outcome = test.outcome();
    const status: Finished['status'] = outcome === 'flaky' ? 'flaky' : result.status;
    const counts = this.state.counts;
    if (result.status === 'skipped') counts.skipped++;
    else if (outcome === 'flaky') counts.flaky++;
    else if (result.status === 'passed') counts.passed++;
    else if (test.results.length > test.retries) counts.failed++;
    else return this.changed(); // will be retried: not final yet
    counts.done++;
    const finished: Finished = {
      id,
      project: test.parent.project()?.name ?? '',
      file: fileOf(test),
      title: test.title,
      status,
      duration: result.duration,
      error: result.error?.message ? stripAnsi(result.error.message).split('\n').find((l) => l.trim())?.slice(0, 240) : undefined,
      at: Date.now(),
    };
    this.state.recent = [finished, ...this.state.recent].slice(0, MAX_RECENT);
    if (status === 'failed' || status === 'timedOut' || status === 'interrupted') this.state.failures.push(finished);
    this.changed();
  }

  onEnd(result: FullResult) {
    if (!this.on) return;
    this.state.finished = { status: result.status, duration: result.duration };
    this.flush();
  }

  async onExit() {
    // The workers' lane locks (runtime.ts) live in a directory per run.
    if (this.settings.enabled) rmSync(join(tmpdir(), 'fintivio-e2e-visual', this.settings.runId), { recursive: true, force: true });
    if (!this.on) return;
    // Leave the final result on screen for a moment before closing the window.
    const hold = Number(process.env.E2E_VISUAL_MONITOR_HOLD ?? 4000);
    if (hold > 0) await new Promise((r) => setTimeout(r, hold));
    const window = await this.window;
    await window?.close().catch(() => { });
    for (const client of this.clients) client.end();
    this.server?.close();
    if (this.profileDir) rmSync(this.profileDir, { recursive: true, force: true });
  }

  // --- state push -------------------------------------------------------------------------------------------------

  private changed() {
    this.flushTimer ??= setTimeout(() => this.flush(), 200);
  }

  private flush() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.state.running = [...this.running.values()].sort((a, b) => a.worker - b.worker);
    const data = `data: ${JSON.stringify(this.state)}\n\n`;
    for (const client of this.clients) client.write(data);
  }

  // --- server and window ------------------------------------------------------------------------------------------

  private async open() {
    this.server = createServer((req, res) => {
      if (req.url === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        this.clients.add(res);
        req.on('close', () => this.clients.delete(res));
        res.write(`data: ${JSON.stringify(this.state)}\n\n`);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(monitorPage());
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.server.unref();

    const s = this.settings;
    const screen = s.screen!;
    const cellWidth = screen.availWidth / s.grid.cols;
    const cellHeight = screen.availHeight / s.grid.rows;
    const last = s.grid.cols * s.grid.rows - 1;
    const bounds = {
      left: Math.round(screen.availLeft + (last % s.grid.cols) * cellWidth),
      top: Math.round(screen.availTop + Math.floor(last / s.grid.cols) * cellHeight),
      width: Math.round(cellWidth),
      height: Math.round(cellHeight),
    };
    // An app window (no tab strip, no address bar) of its own browser, not one of the browsers under test.
    this.profileDir = mkdtempSync(join(tmpdir(), 'fintivio-e2e-monitor-'));
    const context = await chromium.launchPersistentContext(this.profileDir, {
      headless: false,
      viewport: null,
      ...(s.executablePath ? { executablePath: s.executablePath } : {}),
      // Not a browser under test: none of the info bars ("controlled by automated test software", "unsupported
      // command-line flag: --no-sandbox", "Google API keys are missing") that would take a third of a small tile.
      ignoreDefaultArgs: ['--enable-automation'],
      env: { ...process.env, GOOGLE_API_KEY: 'no', GOOGLE_DEFAULT_CLIENT_ID: 'no', GOOGLE_DEFAULT_CLIENT_SECRET: 'no' },
      args: [
        `--app=http://127.0.0.1:${port}/`,
        '--test-type',
        `--window-position=${bounds.left},${bounds.top}`,
        `--window-size=${bounds.width},${bounds.height}`,
      ],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds });
    await cdp.detach();
    return context;
  }
}
