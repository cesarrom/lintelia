#!/usr/bin/env bun
/**
 * The local stack in one command (docs/plans/08 §One command).
 *
 *   bun run stack [--profile core|full|e2e] [--only a,b] [--skip a,b] [--detach]
 *   bun run stack:status | stack:logs [service] | stack:restart <service> | stack:stop | stack:reset | stack:doctor
 *
 * The e2e suite has its own entry point that uses this one: `bun e2e` (scripts/e2e.ts; `stack:test` is an alias).
 *
 * Services are declared in dev/stack.config.ts; ports in dev/ports.json. Services that are already healthy (started
 * elsewhere) are reused, not started twice. Logs go to .data/stack/logs/<service>.log and, in the foreground, to the
 * console with a prefix. Ctrl-C stops everything this command started.
 */
import { appendFileSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { stack, type Check, type StackEntry } from '../dev/stack.config';

const ROOT = resolve(import.meta.dir, '..');
const STATE_DIR = join(ROOT, '.data/stack');
const LOG_DIR = join(STATE_DIR, 'logs');
const STATE_FILE = join(STATE_DIR, 'state.json');
const RESTART_FILE = join(STATE_DIR, 'restart');
mkdirSync(LOG_DIR, { recursive: true });

const COLORS = [36, 33, 35, 32, 34, 91, 96, 93, 95, 92, 94];
const color = (index: number, text: string) => `\x1b[${COLORS[index % COLORS.length]}m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

// --- arguments ---------------------------------------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith('-') ? args.shift()! : 'up';
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const list = (value?: string) => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []);

// --- health checks ---------------------------------------------------------------------------------------------------

const tcpOpen = (port: number) => new Promise<boolean>((done) => {
  const socket = connect({ port, host: '127.0.0.1' });
  const finish = (ok: boolean) => { socket.destroy(); done(ok); };
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
  socket.setTimeout(1000, () => finish(false));
});

async function httpOk(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Is the service up right now (whoever started it)? Log checks fall back to the port when one is given. */
async function isHealthy(check: Check | undefined, logText = ''): Promise<boolean> {
  if (!check) return true;
  if (check.type === 'http') return httpOk(check.url);
  if (check.type === 'tcp') return tcpOpen(check.port);
  return check.pattern.test(logText);
}

async function isRunningElsewhere(entry: StackEntry) {
  const check = entry.check;
  if (!check) return false;
  if (check.type === 'log') return check.port ? tcpOpen(check.port) : false;
  return isHealthy(check);
}

// --- selection -------------------------------------------------------------------------------------------------------

function select(): StackEntry[] {
  const profile = (option('profile') ?? 'full') as StackEntry['profiles'][number];
  const only = list(option('only'));
  const skip = new Set(list(option('skip')));
  const byName = new Map(stack.map((e) => [e.name, e]));
  const wanted = new Set<string>();
  const add = (name: string) => {
    const entry = byName.get(name);
    if (!entry) throw new Error(`Unknown service "${name}". Known: ${stack.map((e) => e.name).join(', ')}`);
    if (wanted.has(name) || skip.has(name)) return;
    wanted.add(name);
    for (const dep of entry.dependsOn ?? []) add(dep);
  };
  for (const entry of stack) if (only.length ? only.includes(entry.name) : entry.profiles.includes(profile)) add(entry.name);
  return stack.filter((e) => wanted.has(e.name));
}

// --- first run -------------------------------------------------------------------------------------------------------

function firstRunSetup() {
  if (!existsSync(join(ROOT, 'node_modules'))) {
    console.log(bold('Installing dependencies (bun install)…'));
    spawnSync('bun', ['install'], { cwd: ROOT, stdio: 'inherit' });
  }
  const envFiles = [
    { file: 'apps/core/.env', example: 'apps/core/.env.example', secrets: ['AUTH_JWT_SECRET'] },
    { file: 'apps/web/.env', example: 'apps/web/.env.example', secrets: [] },
  ];
  for (const { file, example, secrets } of envFiles) {
    const path = join(ROOT, file);
    if (existsSync(path) || !existsSync(join(ROOT, example))) continue;
    copyFileSync(join(ROOT, example), path);
    let content = readFileSync(path, 'utf8');
    for (const name of secrets) {
      content = content.replace(new RegExp(`^${name}=\\s*$`, 'm'), `${name}=${randomBytes(32).toString('base64url')}`);
    }
    writeFileSync(path, content);
    console.log(`created ${file} from ${example} (development secrets generated)`);
  }
}

// --- doctor ----------------------------------------------------------------------------------------------------------

async function doctor(quiet = false) {
  const problems: string[] = [];
  const notes: string[] = [];
  const [major, minor] = Bun.version.split('.').map(Number);
  if (major < 1 || (major === 1 && minor < 3)) problems.push(`Bun ${Bun.version} is too old: install 1.3.x (npm i -g bun@1.3.14)`);
  if (process.getuid?.() === 0) problems.push('Running as root: embedded Postgres refuses to start as root; use a normal user');
  if (!existsSync(join(ROOT, 'node_modules'))) notes.push('dependencies not installed yet: `bun install` (the stack does it on first run)');
  for (const file of ['apps/core/.env', 'apps/web/.env']) {
    if (!existsSync(join(ROOT, file))) notes.push(`${file} missing: created from its .env.example on first run`);
  }
  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsers) notes.push('PLAYWRIGHT_BROWSERS_PATH not set: run `bunx playwright install chromium` once before `bun e2e`');
  try {
    // Can the e2e browser tests run in visible windows here? (apps/e2e/support/visual; opens a window off-screen briefly)
    const { detectVisual } = await import('../apps/e2e/support/visual/detect');
    const visual = detectVisual();
    notes.push(visual.enabled
      ? `e2e visual mode: on (${visual.reason}): browser tests run in windows you can watch; E2E_VISUAL=0 for headless`
      : `e2e visual mode: off (${visual.reason}): browser tests run headless`);
  } catch (error) {
    notes.push(`e2e visual mode: not checked (${(error as Error).message.split('\n')[0]})`);
  }
  const free = spawnSync('df', ['-Pk', ROOT], { encoding: 'utf8' }).stdout?.split('\n')[1]?.split(/\s+/)[3];
  if (free && Number(free) < 2_000_000) problems.push(`less than 2 GB free disk space at ${ROOT}`);
  const ports = JSON.parse(readFileSync(join(ROOT, 'dev/ports.json'), 'utf8')).services as Record<string, { port: number }>;
  const busy: string[] = [];
  for (const [name, { port }] of Object.entries(ports)) if (await tcpOpen(port)) busy.push(`${name}:${port}`);
  if (busy.length) notes.push(`ports in use (reused if they are our services): ${busy.join(', ')}`);
  if (!quiet) {
    console.log(bold('Fintivio stack doctor'));
    for (const p of problems) console.log(red(`  ✗ ${p}`));
    for (const n of notes) console.log(dim(`  · ${n}`));
    if (!problems.length) console.log(green('  ✓ ready to run `bun run stack`'));
  }
  return problems;
}

// --- supervisor --------------------------------------------------------------------------------------------------------

interface Running {
  entry: StackEntry;
  proc: ReturnType<typeof Bun.spawn> | null;
  log: string;
  reused: boolean;
  restarts: number;
  stopping: boolean;
  restartRequested?: boolean;
  supervise?: (proc: ReturnType<typeof Bun.spawn>) => Promise<void>;
}

const running = new Map<string, Running>();
let shuttingDown = false;
const foreground = !process.env.FINTIVIO_STACK_DETACHED;

function logLine(entry: StackEntry, index: number, line: string) {
  appendFileSync(join(LOG_DIR, `${entry.name}.log`), `${line}\n`);
  if (foreground && line.trim()) {
    const highlighted = /\berror\b|exception|failed|ERR!/i.test(line) ? red(line) : line;
    console.log(`${color(index, `[${entry.name}]`.padEnd(14))} ${highlighted}`);
  }
}

async function pipe(stream: ReadableStream<Uint8Array> | null, onLine: (line: string) => void) {
  if (!stream) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) onLine(line);
  }
  if (buffer) onLine(buffer);
}

function spawnEntry(entry: StackEntry, index: number, state: Running) {
  const hasSetsid = spawnSync('which', ['setsid']).status === 0;
  const cmd = hasSetsid ? ['setsid', ...entry.command] : entry.command;
  writeFileSync(join(LOG_DIR, `${entry.name}.log`), `--- ${new Date().toISOString()} ${entry.command.join(' ')}\n`, { flag: 'a' });
  const proc = Bun.spawn(cmd, {
    cwd: join(ROOT, entry.cwd),
    env: { ...process.env, FORCE_COLOR: '0', ...entry.env },
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });
  state.proc = proc;
  const onLine = (line: string) => {
    state.log = (state.log + line + '\n').slice(-20000);
    logLine(entry, index, line);
  };
  void pipe(proc.stdout as ReadableStream<Uint8Array>, onLine);
  void pipe(proc.stderr as ReadableStream<Uint8Array>, onLine);
  return proc;
}

function killGroup(proc: ReturnType<typeof Bun.spawn>, signal: NodeJS.Signals) {
  try {
    process.kill(-proc.pid, signal);
  } catch {
    try { proc.kill(signal); } catch { /* gone */ }
  }
}

async function waitHealthy(state: Running, index: number) {
  const { entry } = state;
  const deadline = Date.now() + (entry.timeout ?? 90) * 1000;
  while (Date.now() < deadline) {
    if (state.proc && state.proc.exitCode !== null && entry.kind === 'service') return false;
    if (await isHealthy(entry.check, state.log)) return true;
    await Bun.sleep(500);
  }
  return false;
}

async function startService(entry: StackEntry, index: number) {
  const state: Running = { entry, proc: null, log: '', reused: false, restarts: 0, stopping: false };
  running.set(entry.name, state);
  if (await isRunningElsewhere(entry)) {
    state.reused = true;
    console.log(`${color(index, `[${entry.name}]`.padEnd(14))} ${dim('already running, reused')}`);
    return true;
  }
  const proc = spawnEntry(entry, index, state);
  const supervise = async (current: ReturnType<typeof Bun.spawn>) => {
    const startedAt = Date.now();
    const code = await current.exited;
    if (shuttingDown || state.stopping) return;
    if (state.restartRequested) {
      state.restartRequested = false;
      state.restarts = 0;
      logLine(entry, index, 'restarting on request…');
      void supervise(spawnEntry(entry, index, state));
      saveState();
      return;
    }
    // A process that ran for a while before exiting gets a fresh restart budget.
    if (Date.now() - startedAt > 60_000) state.restarts = 0;
    if (state.restarts >= 5) {
      logLine(entry, index, red(`exited with ${code}; not restarting again (see .data/stack/logs/${entry.name}.log)`));
      return;
    }
    state.restarts += 1;
    logLine(entry, index, red(`exited with ${code}; restarting (${state.restarts}/5)…`));
    await Bun.sleep(1000 * state.restarts);
    if (!shuttingDown) {
      void supervise(spawnEntry(entry, index, state));
      saveState();
    }
  };
  state.supervise = supervise;
  void supervise(proc);
  const healthy = await waitHealthy(state, index);
  if (!healthy) logLine(entry, index, red(`not healthy after ${entry.timeout ?? 90}s`));
  return healthy;
}

async function runTask(entry: StackEntry, index: number) {
  const state: Running = { entry, proc: null, log: '', reused: false, restarts: 0, stopping: false };
  running.set(entry.name, state);
  const proc = spawnEntry(entry, index, state);
  const code = await proc.exited;
  running.delete(entry.name);
  if (code !== 0) logLine(entry, index, red(`failed with exit code ${code}`));
  return code === 0;
}

function saveState(extra: Record<string, unknown> = {}) {
  const services = [...running.values()].filter((r) => r.entry.kind === 'service').map((r) => ({ name: r.entry.name, pid: r.proc?.pid ?? null, reused: r.reused }));
  writeFileSync(STATE_FILE, JSON.stringify({ supervisorPid: process.pid, startedAt: new Date().toISOString(), services, ...extra }, null, 2));
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(bold('\nStopping the stack…'));
  const owned = [...running.values()].filter((r) => r.proc && !r.reused).reverse();
  for (const r of owned) {
    r.stopping = true;
    killGroup(r.proc!, 'SIGTERM');
  }
  const deadline = Date.now() + 10_000;
  for (const r of owned) {
    while (r.proc!.exitCode === null && Date.now() < deadline) await Bun.sleep(100);
    if (r.proc!.exitCode === null) killGroup(r.proc!, 'SIGKILL');
  }
  rmSync(STATE_FILE, { force: true });
  console.log(green('Stopped.'));
  process.exit(code);
}

function summary(selected: StackEntry[], seconds: number) {
  const services = selected.filter((e) => e.kind === 'service');
  const lines = [
    '',
    bold(`Fintivio local stack — ${services.length} services healthy (${seconds.toFixed(0)} s)`),
    '',
    `  Back office (Demo Bank)   http://demo-bank.localhost:3001      analyst@demo-bank.test / fintivio-dev-password (any seeded account)`,
    `  Platform console          http://localhost:3001               staff@fintivio.local / fintivio-dev-password + code from \`bun run totp\``,
    `  Client portal             http://demo-bank.localhost:3001/portal   client@demo-bank.test, or "Email me a code"`,
    ...services.filter((e) => e.url && !['web', 'api'].includes(e.name)).map((e) => `  ${(e.label ?? e.name).padEnd(26)}${e.url}`),
    `  API                       http://localhost:8000 · Restate admin http://localhost:9070`,
    '',
    dim('  Logs: bun run stack:logs [service] · Status: bun run stack:status · Stop: Ctrl-C (or bun run stack:stop)'),
    '',
  ];
  console.log(lines.join('\n'));
}

async function up() {
  const problems = await doctor(true);
  if (problems.length) {
    await doctor();
    process.exit(1);
  }
  firstRunSetup();
  const selected = select();
  const started = Date.now();
  const done = new Map<string, Promise<boolean>>();
  const index = (name: string) => stack.findIndex((e) => e.name === name);

  const launch = (entry: StackEntry): Promise<boolean> => {
    if (done.has(entry.name)) return done.get(entry.name)!;
    const promise = (async () => {
      const deps = (entry.dependsOn ?? []).map((d) => selected.find((e) => e.name === d)).filter(Boolean) as StackEntry[];
      const results = await Promise.all(deps.map(launch));
      if (results.some((ok) => !ok)) {
        console.log(red(`[${entry.name}] skipped: a dependency failed`));
        return false;
      }
      return entry.kind === 'task' ? runTask(entry, index(entry.name)) : startService(entry, index(entry.name));
    })();
    done.set(entry.name, promise);
    return promise;
  };

  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));
  // `bun run stack:restart <service>` writes the names to RESTART_FILE and signals the supervisor.
  process.on('SIGUSR2', () => {
    const names = existsSync(RESTART_FILE) ? list(readFileSync(RESTART_FILE, 'utf8')) : [];
    rmSync(RESTART_FILE, { force: true });
    for (const name of names) {
      const state = running.get(name);
      if (!state || state.reused) { console.log(red(`[${name}] is not managed by this stack; not restarted`)); continue; }
      if (state.proc && state.proc.exitCode === null) {
        state.restartRequested = true;
        killGroup(state.proc, 'SIGTERM');
      } else {
        // Gave up after too many crashes: start it again with a fresh budget.
        state.restarts = 0;
        const index = stack.findIndex((e) => e.name === name);
        void state.supervise?.(spawnEntry(state.entry, index, state));
        saveState();
      }
    }
  });

  const results = await Promise.all(selected.map(launch));
  saveState();
  if (results.some((ok) => !ok)) {
    const failed = selected.filter((_, i) => !results[i]).map((e) => e.name);
    console.log(red(bold(`\nSome services failed: ${failed.join(', ')}. Logs: .data/stack/logs/<service>.log`)));
    if (!foreground) await shutdown(1);
  } else {
    summary(selected, (Date.now() - started) / 1000);
    writeFileSync(join(STATE_DIR, 'ready'), new Date().toISOString());
  }
  await new Promise(() => { });
}

function readState(): { supervisorPid: number; services: Array<{ name: string; pid: number | null; reused: boolean }> } | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

const alive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

async function detach() {
  const existing = readState();
  if (existing && alive(existing.supervisorPid)) {
    console.log(`The stack is already running (supervisor pid ${existing.supervisorPid}). \`bun run stack:status\``);
    return;
  }
  rmSync(join(STATE_DIR, 'ready'), { force: true });
  const out = openSync(join(LOG_DIR, '_supervisor.log'), 'a');
  const hasSetsid = spawnSync('which', ['setsid']).status === 0;
  const forwarded = args.filter((a) => a !== '--detach');
  const cmd = [...(hasSetsid ? ['setsid'] : []), 'bun', join(ROOT, 'scripts/stack.ts'), 'up', ...forwarded];
  const child = Bun.spawn(cmd, { cwd: ROOT, env: { ...process.env, FINTIVIO_STACK_DETACHED: '1' }, stdout: out, stderr: out, stdin: 'ignore' });
  child.unref();
  closeSync(out);
  console.log(`Starting the stack in the background (supervisor pid ${child.pid}); waiting until it is healthy…`);
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    if (existsSync(join(STATE_DIR, 'ready'))) {
      console.log(green('Stack ready.'));
      await status();
      return;
    }
    if (child.exitCode !== null) {
      console.log(red(`The stack failed to start; see .data/stack/logs/_supervisor.log`));
      process.exit(1);
    }
    await Bun.sleep(1000);
  }
  console.log(red('Timed out waiting for the stack.'));
  process.exit(1);
}

async function status() {
  const state = readState();
  console.log(bold('Service'.padEnd(32)) + bold('Status'.padEnd(12)) + bold('Check'.padEnd(48)) + bold('Managed by'));
  for (const entry of stack.filter((e) => e.kind === 'service')) {
    const check = entry.check;
    let healthy = false;
    let label = '';
    if (check?.type === 'http') { healthy = await httpOk(check.url); label = check.url; }
    else if (check?.type === 'tcp') { healthy = await tcpOpen(check.port); label = `tcp :${check.port}`; }
    else if (check?.type === 'log') { healthy = check.port ? await tcpOpen(check.port) : existsSync(join(LOG_DIR, `${entry.name}.log`)); label = check.port ? `tcp :${check.port}` : 'log'; }
    const owned = state?.services.find((s) => s.name === entry.name);
    const manager = owned ? (owned.reused ? 'external (reused)' : `stack (pid ${owned.pid})`) : 'external';
    console.log(entry.name.padEnd(32) + (healthy ? green('up'.padEnd(12)) : red('down'.padEnd(12))) + label.padEnd(48) + dim(manager));
  }
  if (state) console.log(dim(`\nsupervisor pid ${state.supervisorPid} (${alive(state.supervisorPid) ? 'running' : 'not running'})`));
}

async function stop() {
  const state = readState();
  if (!state || !alive(state.supervisorPid)) {
    console.log('No stack supervisor is running (services started elsewhere are left alone).');
    rmSync(STATE_FILE, { force: true });
    return;
  }
  process.kill(state.supervisorPid, 'SIGTERM');
  const deadline = Date.now() + 20_000;
  while (alive(state.supervisorPid) && Date.now() < deadline) await Bun.sleep(200);
  console.log(alive(state.supervisorPid) ? red('The supervisor did not stop in time.') : green('Stack stopped.'));
}

function logs() {
  const service = args[0];
  const files = service ? [join(LOG_DIR, `${service}.log`)] : stack.map((e) => join(LOG_DIR, `${e.name}.log`)).filter(existsSync);
  if (!files.length || !files.every(existsSync)) {
    console.log(`No logs${service ? ` for ${service}` : ''} yet in ${LOG_DIR}.`);
    return;
  }
  spawnSync('tail', ['-n', '100', '-F', ...files], { stdio: 'inherit' });
}

async function reset() {
  await stop();
  const running = (await Promise.all(stack.filter((e) => e.kind === 'service').map(async (e) => (await isRunningElsewhere(e)) ? e.name : null))).filter(Boolean);
  if (running.length) {
    console.log(red(`These services are still running outside the stack: ${running.join(', ')}. Stop them first, then re-run stack:reset.`));
    process.exit(1);
  }
  for (const dir of ['apps/core/.data/postgres', 'apps/core/.data/restate', 'apps/core/.data/redis', 'apps/core/.data/outbox', 'apps/core/.data/storage', '.data/fake-services', '.data/connectors']) {
    rmSync(join(ROOT, dir), { recursive: true, force: true });
  }
  console.log(green('Local state wiped (databases, Redis, Restate, fake services, connectors).'));
  if (!flag('no-start')) await detach();
}

/** Kept for compatibility: the e2e suite's entry point is `bun e2e` (scripts/e2e.ts), which this forwards to. */
function test() {
  const forwarded = args.filter((a) => a !== '--');
  const result = spawnSync('bun', [join(ROOT, 'scripts/e2e.ts'), ...forwarded], { cwd: ROOT, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

async function restart() {
  const state = readState();
  const names = args.filter((a) => !a.startsWith('-'));
  if (!state || !alive(state.supervisorPid)) {
    console.log('No stack supervisor is running: start it with `bun run stack`.');
    process.exit(1);
  }
  if (!names.length) {
    console.log('usage: bun run stack:restart <service> [service…]');
    process.exit(1);
  }
  writeFileSync(RESTART_FILE, names.join(','));
  process.kill(state.supervisorPid, 'SIGUSR2');
  const entries = names.map((n) => stack.find((e) => e.name === n)).filter(Boolean) as StackEntry[];
  await Bun.sleep(1500);
  const deadline = Date.now() + 120_000;
  for (const entry of entries) {
    while (!(await isHealthy(entry.check, existsSync(join(LOG_DIR, `${entry.name}.log`)) ? readFileSync(join(LOG_DIR, `${entry.name}.log`), 'utf8').slice(-20000) : '')) && Date.now() < deadline) await Bun.sleep(500);
  }
  await status();
}

const commands: Record<string, () => Promise<unknown> | unknown> = {
  restart,
  up: () => (flag('detach') ? detach() : up()),
  status,
  stop,
  logs,
  reset,
  doctor: async () => process.exit((await doctor()).length ? 1 : 0),
  test,
};

if (!commands[command]) {
  console.error(`usage: bun run stack [up|status|logs|restart|stop|reset|doctor|test] (got "${command}")`);
  process.exit(1);
}
await commands[command]();
