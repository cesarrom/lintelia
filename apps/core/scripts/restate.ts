/**
 * Local Restate server (npm package @restatedev/restate-server, matched with SDK @restatedev/restate-sdk 1.17.x).
 *
 *   bun run restate:serve      run the server in the foreground (ingress :8080, admin :9070), data in .data/restate
 *   bun run restate:register   register the API's /restate endpoint (the API also does this on startup)
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(import.meta.dir, '..');
for (const candidate of [join(root, '.env'), join(root, '../../.env')]) {
  if (existsSync(candidate)) { config({ path: candidate }); break; }
}

const adminUrl = process.env.RESTATE_ADMIN_ENDPOINT ?? 'http://localhost:9070';
const apiHost = process.env.HOST ?? 'http://localhost:8000';

const repoRoot = resolve(root, '../..');

/** Vendored fallback (submission/offline review): vendor/restate/<platform>-<arch>/restate-server-*.tgz, checked against vendor/SHA256SUMS. */
function vendoredBinary(): string | undefined {
  const platform = `${process.platform}-${process.arch}`;
  const dir = join(repoRoot, 'vendor/restate', platform);
  if (!existsSync(dir)) return undefined;
  const archive = readdirSync(dir).find((f) => /^restate-server-.*\.tgz$/.test(f));
  if (!archive) return undefined;
  const out = join(repoRoot, '.data/restate-bin', platform, archive.replace(/\.tgz$/, ''));
  const binary = join(out, 'restate-server');
  if (existsSync(binary)) return binary;
  const sums = readFileSync(join(repoRoot, 'vendor/SHA256SUMS'), 'utf8');
  const expected = sums.split('\n').find((l) => l.endsWith(`restate/${platform}/${archive}`))?.split(/\s+/)[0];
  const actual = createHash('sha256').update(readFileSync(join(dir, archive))).digest('hex');
  if (!expected || expected !== actual) throw new Error(`vendored ${archive}: checksum mismatch against vendor/SHA256SUMS`);
  // Extract to a temporary directory and rename, so an interrupted run never leaves a truncated binary behind.
  const tmp = `${out}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const untar = spawnSync('tar', ['-xzf', join(dir, archive), '-C', tmp, '--strip-components=2', 'package/bin/restate-server']);
  if (untar.status !== 0) throw new Error(`could not extract ${archive}: ${untar.stderr}`);
  rmSync(out, { recursive: true, force: true });
  renameSync(tmp, out);
  console.log(`restate-server: using vendored ${archive} (BUSL 1.1, see vendor/restate/LICENSE)`);
  return binary;
}

/** node_modules binary (default), else the vendored one; RESTATE_USE_VENDORED=1 prefers the vendored one. */
function findBinary(name: string) {
  const fromModules = () => {
    for (const dir of [join(root, 'node_modules/.bin'), join(repoRoot, 'node_modules/.bin')]) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  };
  const found = process.env.RESTATE_USE_VENDORED === '1' ? (vendoredBinary() ?? fromModules()) : (fromModules() ?? vendoredBinary());
  if (!found) throw new Error(`${name} not found: run bun install, or use vendor/restate (linux-x64 only; see docs/SUBMISSION-RUN.md)`);
  return found;
}

async function serve() {
  const dataDir = resolve(root, '.data/restate');
  mkdirSync(dataDir, { recursive: true });
  const child = spawn(findBinary('restate-server'), ['--base-dir', dataDir], { stdio: 'inherit', cwd: dataDir });
  const stop = () => child.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => process.exit(code ?? 0));
}

async function register() {
  const uri = new URL('/restate', apiHost).toString();
  const response = await fetch(new URL('/deployments', adminUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri, force: true, use_http_11: true }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`registration failed: ${response.status} ${body}`);
  const { services = [] } = JSON.parse(body) as { services?: Array<{ name: string }> };
  console.log(`registered ${uri}: ${services.map((s) => s.name).sort().join(', ')}`);
}

const commands: Record<string, () => Promise<void>> = { serve, register };
const command = process.argv[2];
if (!command || !commands[command]) {
  console.error(`usage: bun scripts/restate.ts <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}
commands[command]().catch((error) => { console.error(error.message ?? error); process.exit(1); });
