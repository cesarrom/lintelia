/**
 * Local Redis (sessions, one-time codes, rate limits).
 *
 *   bun run redis:start   run redis-server in the foreground, data in .data/redis
 *
 * Binary lookup: REDIS_SERVER_BIN, then `redis-server` on PATH, then .data/bin/redis-server. When none exists, the
 * script fetches the prebuilt redis-server shipped inside the `redislite` wheel on PyPI (Redis 6.2, Linux/macOS) with
 * `pip download` and extracts it to .data/bin. Deployed environments use a managed Redis 7+; only basic commands
 * (strings, hashes, sets, INCR/EXPIRE, SET NX) are used, so any Redis/Valkey works.
 */
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(import.meta.dir, '..');
for (const candidate of [join(root, '.env'), join(root, '../../.env')]) {
  if (existsSync(candidate)) { config({ path: candidate }); break; }
}

const REDISLITE_VERSION = '6.2.912183';
const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6380');
const binDir = resolve(root, '.data/bin');
const dataDir = resolve(root, '.data/redis');

function onPath(name: string) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().split('\n')[0] : null;
}

async function fetchFromRedislite(): Promise<string> {
  const python = onPath('python3') ?? onPath('python');
  if (!python) throw new Error('No redis-server found and no python3 to fetch one. Install Redis (brew/apt) or set REDIS_SERVER_BIN.');
  const tmp = resolve(root, '.data/redislite-download');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  console.log(`fetching redis-server from the redislite ${REDISLITE_VERSION} wheel (PyPI)...`);
  const download = spawnSync(python, ['-m', 'pip', 'download', `redislite==${REDISLITE_VERSION}`, '--no-deps', '--only-binary', ':all:', '-d', tmp], { stdio: 'inherit' });
  if (download.status !== 0) throw new Error('pip download redislite failed; install Redis yourself or set REDIS_SERVER_BIN');
  const wheel = readdirSync(tmp).find((f) => f.endsWith('.whl'));
  if (!wheel) throw new Error('redislite wheel not found after download');
  const extract = `import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nfor n in ('redislite/bin/redis-server','redislite/bin/redis-cli'):\n    open(sys.argv[2]+'/'+n.split('/')[-1],'wb').write(z.read(n))`;
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(tmp, 'extract.py'), extract);
  const extracted = spawnSync(python, [join(tmp, 'extract.py'), join(tmp, wheel), binDir], { stdio: 'inherit' });
  if (extracted.status !== 0) throw new Error('could not extract redis-server from the wheel');
  for (const name of ['redis-server', 'redis-cli']) chmodSync(join(binDir, name), 0o755);
  rmSync(tmp, { recursive: true, force: true });
  return join(binDir, 'redis-server');
}

async function findBinary() {
  if (process.env.REDIS_SERVER_BIN) return process.env.REDIS_SERVER_BIN;
  const fromPath = onPath('redis-server') ?? onPath('valkey-server');
  if (fromPath) return fromPath;
  const local = join(binDir, 'redis-server');
  if (existsSync(local)) return local;
  return fetchFromRedislite();
}

async function start() {
  const binary = await findBinary();
  mkdirSync(dataDir, { recursive: true });
  const args = ['--port', redisUrl.port || '6379', '--bind', '127.0.0.1', '--dir', dataDir, '--appendonly', 'yes', '--save', ''];
  if (redisUrl.password) args.push('--requirepass', decodeURIComponent(redisUrl.password));
  console.log(`starting ${binary} on port ${redisUrl.port || 6379} (data in ${dataDir})`);
  const child = spawn(binary, args, { stdio: 'inherit' });
  const stop = () => child.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => process.exit(code ?? 0));
}

const commands: Record<string, () => Promise<void>> = { start };
const command = process.argv[2];
if (!command || !commands[command]) {
  console.error(`usage: bun scripts/redis.ts <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}
commands[command]().catch((error) => { console.error(error.message ?? error); process.exit(1); });
