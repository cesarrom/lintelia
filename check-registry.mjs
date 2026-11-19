// Usage (inside an unzipped project):  node check-registry.mjs [--all]
// Reads the lockfile (bun.lock, pnpm-lock.yaml or package-lock.json), then asks the CONFIGURED npm registry
// whether each pinned name@version is visible. Prints how many are missing, so you know up front whether
// `install --frozen-lockfile` can work in this environment. Only registry metadata is requested; nothing is installed.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
let reg = process.env.NPM_REGISTRY; if (!reg) { try { reg = execSync('npm config get registry').toString().trim(); } catch { reg = 'https://registry.npmjs.org/'; } }
const registry = reg.replace(/\/$/, '');
const all = process.argv.includes('--all');
const pairs = new Map();
const add = (n, v) => { if (n && v && /^\d/.test(v) && !n.startsWith('@repo/')) pairs.set(`${n}@${v}`, [n, v]); };
if (existsSync('bun.lock')) {
  for (const m of readFileSync('bun.lock', 'utf8').matchAll(/^\s*"[^"]+":\s*\["((?:@[^\/"]+\/)?[^@"]+)@([^"]+)"/gm)) add(m[1], m[2]);
} else if (existsSync('pnpm-lock.yaml')) {
  for (const m of readFileSync('pnpm-lock.yaml', 'utf8').matchAll(/^ {2}'?((?:@[^\/'\s]+\/)?[^@'\s]+)@(\d[^':\s(]*)/gm)) add(m[1], m[2]);
} else if (existsSync('package-lock.json')) {
  const j = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  for (const [k, v] of Object.entries(j.packages || {})) if (k.includes('node_modules/')) add(k.split('node_modules/').pop(), v.version);
} else { console.error('no lockfile found'); process.exit(2); }
let list = [...pairs.values()];
if (!all && list.length > 400) { list = list.filter((_, i) => i % Math.ceil(list.length / 400) === 0); console.log(`(sampling ${list.length} of ${pairs.size}; use --all for everything)`); }
const byName = new Map(); for (const [n, v] of list) (byName.get(n) ?? byName.set(n, []).get(n)).push(v);
const missing = [], errors = []; let done = 0;
const names = [...byName.keys()];
async function worker() {
  while (names.length) {
    const n = names.pop();
    try {
      const r = await fetch(`${registry}/${n.replace('/', '%2F')}`, { headers: { accept: 'application/vnd.npm.install-v1+json' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { errors.push(`${n}: HTTP ${r.status}`); continue; }
      const d = await r.json(); const have = Object.keys(d.versions || {});
      for (const v of byName.get(n)) if (!d.versions[v]) missing.push({ n, v, visible: have.length, newest: d['dist-tags']?.latest });
    } catch (e) { errors.push(`${n}: ${e.message}`); }
    if (++done % 50 === 0) process.stdout.write('.');
  }
}
await Promise.all(Array.from({ length: 12 }, worker));
console.log(`\nregistry: ${registry}\nchecked ${list.length} pinned versions: ${missing.length} not visible, ${errors.length} lookup errors`);
for (const m of missing.slice(0, 25)) console.log(`  MISSING ${m.n}@${m.v}  (registry shows ${m.visible} versions, latest ${m.newest})`);
for (const e of errors.slice(0, 10)) console.log('  ERROR', e);
writeFileSync('registry-missing.txt', missing.map(m => `${m.n}@${m.v}`).join('\n'));
console.log(missing.length ? 'RESULT: lockfile pins are NOT all installable here -> see registry-missing.txt' : 'RESULT: all sampled pins visible');
