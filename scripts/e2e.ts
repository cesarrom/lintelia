#!/usr/bin/env bun
/**
 * `bun e2e` — make the end-to-end suite happen (docs/testing/e2e.md §Running the suite).
 *
 *   bun e2e [--attach | --force] [--headed | --headless] [--keep] [playwright args…] [-- playwright args…]
 *
 * The stack:
 *  - every service of the e2e profile is up          → attach to it (what `--attach` asks for explicitly);
 *  - nothing is up                                    → start the whole stack in the background, run, stop it after
 *                                                       (`--keep` leaves it running);
 *  - the stack supervisor is still starting services  → wait for it;
 *  - some services up, others down (partially up)     → stop with an error: start the whole stack yourself
 *                                                       (`bun run stack --detach`) and re-run, or `bun e2e --force`;
 *  - `--force`                                        → stop the stack and anything else on its ports, start it
 *                                                       again from scratch, run.
 * The browser tests run in visible windows when this machine can show them (a display and a browser with a UI),
 * headless otherwise; `--headed` / `--headless` decide instead. Any other argument goes to Playwright (a file, `--grep
 * @FIA-04`, `--project=api`, `--retries=1`…). A full run (no filter) also rewrites docs/testing/flow-status.md.
 */
import { existsSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { connect } from 'node:net';
import { cpus, homedir, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stack, type StackEntry } from '../dev/stack.config';

const ROOT = resolve(import.meta.dir, '..');
const E2E_DIR = join(ROOT, 'apps/e2e');
const STATE_DIR = join(ROOT, '.data/stack');
const tty = process.stdout.isTTY;
const paint = (code: string) => (text: string) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = paint('1');
const dim = paint('2');
const cyan = paint('36');
const yellow = paint('33');
const red = paint('31');
const green = paint('32');
const info = (text: string) => console.log(`${cyan('e2e ›')} ${text}`);
const warn = (text: string) => console.log(`${yellow('e2e ⚠')} ${yellow(text)}`);
const fail = (lines: string[], code = 2): never => {
  console.error(`${red('e2e ✗')} ${red(bold(lines[0]))}`);
  for (const line of lines.slice(1)) console.error(`  ${line}`);
  process.exit(code);
};

// --- arguments -----------------------------------------------------------------------------------------------------------

const OWN_FLAGS = ['--attach', '--force', '--headed', '--headless', '--keep', '--help', '-h'];
const argv = process.argv.slice(2);
const separator = argv.indexOf('--');
const before = separator >= 0 ? argv.slice(0, separator) : argv;
const after = separator >= 0 ? argv.slice(separator + 1) : [];
const has = (name: string) => before.includes(name);
const playwrightArgs = [...before.filter((a) => !OWN_FLAGS.includes(a)), ...after];

if (has('--help') || has('-h')) {
  console.log(readFileSync(import.meta.path, 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(0);
}
if (has('--attach') && has('--force')) fail(['--attach and --force do not go together', '--attach uses the running stack as it is; --force stops it and starts it again.']);
if (has('--headed') && has('--headless')) fail(['--headed and --headless do not go together', 'Leave both out to let `bun e2e` decide from this machine.']);

// --- the stack: what is up -------------------------------------------------------------------------------------------------

const tcpOpen = (port: number) => new Promise<boolean>((done) => {
  const socket = connect({ port, host: '127.0.0.1' });
  const finish = (ok: boolean) => { socket.destroy(); done(ok); };
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
  socket.setTimeout(1000, () => finish(false));
});

async function httpOk(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), redirect: 'manual' });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Services of the e2e profile that can be checked from outside (the package watcher only logs). */
const SERVICES = stack.filter((e): e is StackEntry & { check: NonNullable<StackEntry['check']> } =>
  e.kind === 'service' && e.profiles.includes('e2e') && !!e.check && (e.check.type !== 'log' || !!e.check.port));

async function probe() {
  const results = await Promise.all(SERVICES.map(async (entry) => {
    const check = entry.check;
    const up = check.type === 'http' ? await httpOk(check.url) : check.type === 'tcp' ? await tcpOpen(check.port) : await tcpOpen(check.port!);
    return { name: entry.name, up };
  }));
  return { up: results.filter((r) => r.up).map((r) => r.name), down: results.filter((r) => !r.up).map((r) => r.name) };
}

interface StackState { supervisorPid: number; services?: Array<{ name: string }> }
const readState = (): StackState | null => {
  try {
    return JSON.parse(readFileSync(join(STATE_DIR, 'state.json'), 'utf8'));
  } catch {
    return null;
  }
};
const alive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
const supervisor = () => {
  const state = readState();
  return state && alive(state.supervisorPid) ? state.supervisorPid : null;
};
/** Services the running supervisor looks after (it started them or is restarting them). */
const managed = () => new Set((readState()?.services ?? []).map((s) => s.name));

function stackCommand(...args: string[]) {
  const result = spawnSync('bun', [join(ROOT, 'scripts/stack.ts'), ...args], { cwd: ROOT, stdio: 'inherit' });
  return result.status ?? 1;
}

// --- --force: whoever holds the stack's ports goes ------------------------------------------------------------------------

const PORTS = Object.entries(JSON.parse(readFileSync(join(ROOT, 'dev/ports.json'), 'utf8')).services as Record<string, { port: number }>)
  .map(([name, { port }]) => ({ name, port }));

/** Processes listening on a TCP port: lsof when present (macOS, most Linux), else /proc (Linux without lsof). */
function listeners(port: number): number[] {
  const lsof = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  if (!lsof.error) return lsof.stdout.split('\n').map(Number).filter((pid) => pid > 0);
  if (!existsSync('/proc/net/tcp')) return [];
  const inodes = new Set<string>();
  const hex = port.toString(16).toUpperCase().padStart(4, '0');
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      // local address ends with :PORT, state 0A = LISTEN
      if (cols[1]?.endsWith(`:${hex}`) && cols[3] === '0A') inodes.add(cols[9]);
    }
  }
  if (!inodes.size) return [];
  const pids: number[] = [];
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) {
        const link = readlinkSync(`/proc/${pid}/fd/${fd}`);
        const inode = /^socket:\[(\d+)\]$/.exec(link)?.[1];
        if (inode && inodes.has(inode)) { pids.push(Number(pid)); break; }
      }
    } catch { /* not ours or gone */ }
  }
  return pids;
}

async function freePorts() {
  const holders = new Map<number, string[]>();
  for (const { name, port } of PORTS) for (const pid of listeners(port)) if (pid !== process.pid) holders.set(pid, [...(holders.get(pid) ?? []), `${name}:${port}`]);
  if (!holders.size) return;
  info(`stopping ${holders.size} process(es) still holding the stack's ports: ${[...holders.values()].flat().join(', ')}`);
  for (const pid of holders.keys()) try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ }
  const deadline = Date.now() + 15_000;
  while ([...holders.keys()].some(alive) && Date.now() < deadline) await Bun.sleep(250);
  for (const pid of holders.keys()) if (alive(pid)) try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
  await Bun.sleep(500);
}

// --- deciding ------------------------------------------------------------------------------------------------------------

const started = Date.now();
console.log(bold('Fintivio end-to-end suite'));

let weStartedTheStack = false;
async function startStack(reason: string) {
  info(`${reason}: starting the whole stack in the background (profile e2e; about 30 s warm, a few minutes the first time)…`);
  const code = stackCommand('up', '--detach', '--profile', 'e2e');
  if (code !== 0) fail(['The stack did not start', 'See .data/stack/logs/_supervisor.log and .data/stack/logs/<service>.log, or run `bun run stack` in the foreground.'], 1);
  weStartedTheStack = true;
}

/** A supervisor that is still bringing services up (or restarting one): give it time before judging. */
async function waitForSupervisor(pid: number) {
  const ready = existsSync(join(STATE_DIR, 'ready'));
  const deadline = Date.now() + (ready ? 90_000 : 10 * 60_000);
  info(ready ? `the stack (supervisor pid ${pid}) has services down: waiting up to 90 s for it to restart them…` : `the stack (supervisor pid ${pid}) is starting: waiting for it…`);
  while (Date.now() < deadline) {
    const state = await probe();
    if (!state.down.length) return state;
    if (!alive(pid)) break;
    await Bun.sleep(2000);
  }
  return probe();
}

let state = await probe();
const supervisorPid = supervisor();

if (has('--force')) {
  info(`--force: stopping the stack${supervisorPid ? ` (supervisor pid ${supervisorPid})` : ''} and everything on its ports, then starting it again`);
  if (supervisorPid) stackCommand('stop');
  await freePorts();
  state = await probe();
  if (state.up.length) fail([`These services are still answering after being stopped: ${state.up.join(', ')}`, 'Stop them by hand (they may run under another user or in a container), then re-run.'], 1);
  await startStack('--force');
} else {
  // A supervisor starting (or restarting) the missing services will get there: wait. One started for a subset
  // (`bun run stack --only …`) will not.
  const starting = supervisorPid && state.down.every((name) => managed().has(name) || !existsSync(join(STATE_DIR, 'ready')));
  if (state.down.length && state.up.length && supervisorPid && starting) state = await waitForSupervisor(supervisorPid);
  if (!state.down.length) {
    info(`${has('--attach') ? '--attach' : 'every service is up'}: attaching to the running stack (${state.up.length} services${supervisorPid ? `, supervisor pid ${supervisorPid}` : ', started outside `bun run stack`'})`);
  } else if (has('--attach')) {
    fail([
      `--attach: the stack is not fully up (${state.down.length} of ${SERVICES.length} services down: ${state.down.join(', ')})`,
      `Start it with ${bold('bun run stack --detach')} (or ${bold('bun e2e')} without --attach to let it start the stack, ${bold('bun e2e --force')} to restart everything).`,
    ]);
  } else if (!state.up.length) {
    await startStack('nothing is running');
  } else {
    fail([
      `The stack is partially up: ${state.up.length} of ${SERVICES.length} services answer, ${state.down.length} do not`,
      `${green('up')}   ${state.up.join(', ')}`,
      `${red('down')} ${state.down.join(', ')}`,
      '',
      '`bun e2e` will not guess whether to start the missing services next to those or to restart everything. Either:',
      supervisorPid
        ? `  • start the whole stack yourself — the running one (supervisor pid ${supervisorPid}) does not manage them all: ${bold('bun run stack:stop && bun run stack --detach')} (a crashed service alone: ${bold('bun run stack:restart <service>')}) — then re-run ${bold('bun e2e')};`
        : `  • start the rest of the stack yourself — ${bold('bun run stack --detach')} reuses what is up and starts the others — then re-run ${bold('bun e2e')};`,
      `  • or run ${bold('bun e2e --force')}: it stops the stack and whatever holds its ports, starts everything again and runs the suite.`,
      dim(`Service logs: .data/stack/logs/<service>.log · status: bun run stack:status`),
    ]);
  }
}

// --- headed or headless ---------------------------------------------------------------------------------------------------

const { decideVisual, VISUAL_DECISION_ENV } = await import('../apps/e2e/support/visual/detect');
if (has('--headed')) process.env.E2E_VISUAL = '1';
if (has('--headless')) process.env.E2E_VISUAL = '0';
// Only API tests selected (`--project=api`, or only *.api.spec.ts files): no browser at all.
const positional = playwrightArgs.filter((a) => !a.startsWith('-') && /spec\.ts$|\//.test(a));
const apiOnly = playwrightArgs.includes('--project=api') || playwrightArgs.join(' ').includes('--project api')
  || (positional.length > 0 && positional.every((a) => /\.api\.spec\.ts$/.test(a)));
const visual = decideVisual(apiOnly ? ['--project', 'api'] : playwrightArgs);
if (has('--headed') && !visual.enabled && !apiOnly) {
  fail([`--headed: the browser tests cannot run in windows here (${visual.reason})`, 'Run without --headed (or with --headless) to run them headless.'], 1);
}
if (visual.enabled) {
  info(`${has('--headed') ? '--headed' : 'a screen is available'}: browser tests run in ${bold('visible windows')} you can watch (${visual.reason}; ${visual.browserLabel}). ${dim('--headless to hide them')}`);
} else if (apiOnly) {
  info('API tests only: no browser needed');
} else if (has('--headless')) {
  info('--headless: browser tests run headless');
} else {
  info(`browser tests run headless (${visual.reason}). ${dim('--headed to insist on windows')}`);
}

// --- warnings worth knowing before a 10-minute run -----------------------------------------------------------------------

const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
const hasChromium = existsSync(browsersDir) && readdirSync(browsersDir).some((d) => d.startsWith('chromium'));
if (!hasChromium && !process.env.E2E_CHROMIUM_PATH) warn(`no Playwright Chromium found in ${browsersDir}: browser tests will fail — run ${bold('bunx playwright install chromium')} once (or set PLAYWRIGHT_BROWSERS_PATH / E2E_CHROMIUM_PATH)`);
const load = loadavg()[0] / cpus().length;
if (load > 1.5) warn(`this machine is busy (load ${loadavg()[0].toFixed(1)} on ${cpus().length} cores): timing-sensitive tests may fail — consider ${bold('E2E_WORKERS=2')} or ${bold('--retries=1')}`);
if (process.env.E2E_START_STACK) warn('E2E_START_STACK is ignored by `bun e2e` (it manages the stack itself)');
/**
 * A run is filtered (flow-status is left alone) when it selects tests: files or folders, `--grep`, `--project`,
 * `--last-failed`… Options that only change how the tests run (`--retries=1`, `--workers 2`, `--reporter`) keep it full.
 */
function selectsTests(args: string[]) {
  const SELECTING = new Set(['-g', '--grep', '--grep-invert', '--project', '--last-failed', '--only-changed', '--shard', '--list', '--test-list', '--test-list-invert']);
  const WITH_VALUE = new Set(['-g', '--grep', '--grep-invert', '--project', '--shard', '--test-list', '--test-list-invert', '--retries', '--workers', '-j', '--reporter', '--timeout', '--global-timeout', '--repeat-each', '--max-failures', '--output', '--trace', '--config', '-c', '--only-changed']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('-')) return true;
    const [name, inline] = arg.split('=');
    if (SELECTING.has(name)) return true;
    if (WITH_VALUE.has(name) && inline === undefined && args[i + 1] && !args[i + 1].startsWith('-')) i++;
  }
  return false;
}
const filtered = selectsTests(playwrightArgs);
if (playwrightArgs.length) info(`Playwright arguments: ${playwrightArgs.join(" ")}`);
if (weStartedTheStack) info(has('--keep') ? 'the stack keeps running after the run (--keep; `bun run stack:stop` stops it)' : `the stack is stopped after the run (${bold('--keep')} leaves it running)`);
console.log('');

// --- run ---------------------------------------------------------------------------------------------------------------

const env: Record<string, string | undefined> = { ...process.env, [VISUAL_DECISION_ENV]: JSON.stringify(visual), E2E_START_STACK: undefined };
const run = spawnSync('bunx', ['playwright', 'test', ...playwrightArgs], { cwd: E2E_DIR, stdio: 'inherit', env });
const code = run.status ?? 1;

console.log('');
if (!filtered) {
  spawnSync('node', ['scripts/flow-status.mjs'], { cwd: E2E_DIR, stdio: 'inherit' });
} else {
  info(dim('a filtered run: docs/testing/flow-status.md is left as it was (a full `bun e2e` rewrites it)'));
}
if (weStartedTheStack && !has('--keep')) {
  info('stopping the stack this run started…');
  stackCommand('stop');
}
const minutes = ((Date.now() - started) / 60_000).toFixed(1);
if (code === 0) info(green(playwrightArgs.includes('--list') ? `done in ${minutes} min` : `done in ${minutes} min: every test passed`));
else console.log(`${red('e2e ✗')} ${red(`done in ${minutes} min: failures above (report: bun run --cwd apps/e2e report)`)}`);
process.exit(code);
