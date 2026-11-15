/**
 * Local Restate server (npm package @restatedev/restate-server, matched with SDK @restatedev/restate-sdk 1.17.x).
 *
 *   bun run restate:serve      run the server in the foreground (ingress :8080, admin :9070), data in .data/restate
 *   bun run restate:register   register the API's /restate endpoint (the API also does this on startup)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(import.meta.dir, '..');
for (const candidate of [join(root, '.env'), join(root, '../../.env')]) {
  if (existsSync(candidate)) { config({ path: candidate }); break; }
}

const adminUrl = process.env.RESTATE_ADMIN_ENDPOINT ?? 'http://localhost:9070';
const apiHost = process.env.HOST ?? 'http://localhost:8000';

function findBinary(name: string) {
  for (const dir of [join(root, 'node_modules/.bin'), join(root, '../../node_modules/.bin')]) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${name} not found; run bun install`);
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
