/**
 * Build-and-watch for @repo/fintivio without ever leaving `dist/` empty (what `bunchee --watch` does: it wipes dist
 * and rebuilds for ~50 s, breaking the API, web and connectors that import it meanwhile).
 *
 * Builds in `.build/` (a copy of the sources) and then replaces the files of `dist/` one by one (rename), so
 * consumers see either the old or the new file. Skips the initial build when dist is newer than every source file.
 * Prints "Build success" after each build (the stack waits for it).
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, watch, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const pkg = resolve(import.meta.dir, '..');
const src = join(pkg, 'src');
const dist = join(pkg, 'dist');
const work = join(pkg, '.build');

const files = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]) : []);

function expectedOutputs() {
  const exports = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).exports as Record<string, { types: string; default: string }>;
  return Object.values(exports).flatMap((e) => [e.types, e.default]).map((p) => join(pkg, p));
}

function upToDate() {
  const outputs = expectedOutputs();
  if (!outputs.every(existsSync)) return false;
  const newestSource = Math.max(...files(src).map((f) => statSync(f).mtimeMs), statSync(join(pkg, 'package.json')).mtimeMs);
  const oldestOutput = Math.min(...outputs.map((f) => statSync(f).mtimeMs));
  return oldestOutput >= newestSource;
}

function run(cmd: string, args: string[], cwd: string) {
  return new Promise<number>((done) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => done(code ?? 1));
  });
}

async function build() {
  const started = Date.now();
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(src, join(work, 'src'), { recursive: true });
  cpSync(join(pkg, 'package.json'), join(work, 'package.json'));
  const tsconfig = JSON.parse(readFileSync(join(pkg, 'tsconfig.json'), 'utf8').replace(/,\s*([}\]])/g, '$1'));
  writeFileSync(join(work, 'tsconfig.json'), JSON.stringify({ ...tsconfig, include: ['src'] }, null, 2));
  const code = await run('bunx', ['bunchee'], work);
  if (code !== 0) {
    console.error(`Build failed (exit ${code}); dist/ left unchanged`);
    return false;
  }
  for (const file of files(join(work, 'dist'))) {
    const target = join(dist, relative(join(work, 'dist'), file));
    mkdirSync(dirname(target), { recursive: true });
    const temp = `${target}.tmp-${process.pid}`;
    cpSync(file, temp);
    renameSync(temp, target);
  }
  rmSync(work, { recursive: true, force: true });
  console.log(`Build success (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  return true;
}

const once = process.argv.includes('--once');
if (upToDate()) console.log('Build success (dist is up to date)');
else await build();
if (once) process.exit(0);

let timer: ReturnType<typeof setTimeout> | null = null;
let building = false;
let again = false;
const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    if (building) { again = true; return; }
    building = true;
    do { again = false; await build(); } while (again);
    building = false;
  }, 300);
};
watch(src, { recursive: true }, schedule);
console.log('Watching src/ for changes…');
