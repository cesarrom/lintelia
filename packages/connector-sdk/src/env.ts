import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

/** Repository root (for dev/ports.json and the local `.data/` directory). */
export const REPO_ROOT = resolve(import.meta.dir, '../../..');

function ports(): Record<string, { port: number; url?: string }> {
  try {
    return JSON.parse(readFileSync(join(REPO_ROOT, 'dev/ports.json'), 'utf8')).services;
  } catch {
    return {};
  }
}

/** Port and URL of a service of the local stack (dev/ports.json), overridable with `<NAME>_PORT`. */
export function devService(name: string, fallbackPort: number) {
  const entry = ports()[name];
  const envPort = process.env[`${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PORT`];
  const port = Number(envPort ?? entry?.port ?? fallbackPort);
  return { port, url: entry?.url && !envPort ? entry.url : `http://localhost:${port}` };
}

export const snake = (id: string) => id.replace(/[^a-z0-9]+/gi, '_').toLowerCase();

/** Settings of a connector process; every value has a local-development default. */
export interface ConnectorEnv {
  port: number;
  /** Public base URL of this connector (what the manifest's `baseUrl` becomes). */
  publicUrl: string;
  coreUrl: string;
  databaseUrl: string;
  /** Key-encryption key (32 bytes) wrapping the data keys of secrets. */
  kek: Buffer;
  /** Directory for local key material. */
  dataDir: string;
  production: boolean;
}

/** Local files holding generated keys (never used when the env variables are set). */
export function localSecretFile(dataDir: string, file: string, create: () => string) {
  const path = join(dataDir, file);
  if (existsSync(path)) return readFileSync(path, 'utf8').trim();
  const value = create();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { mode: 0o600 });
  return value;
}

export function connectorEnv(connectorId: string): ConnectorEnv {
  const production = process.env.NODE_ENV === 'production';
  const service = devService(`connector-${connectorId}`, 4100);
  const dataDir = resolve(process.env.CONNECTOR_DATA_DIR ?? join(REPO_ROOT, '.data/connectors', connectorId));
  const postgresPort = devService('postgres', 5433).port;
  const name = `connector_${snake(connectorId)}`;
  const required = (key: string, fallback: () => string) => {
    const value = process.env[key];
    if (value) return value;
    if (production) throw new Error(`${key} is required in production`);
    return fallback();
  };
  const kekText = required('CONNECTOR_KEK', () => localSecretFile(dataDir, 'kek', () => randomBytes(32).toString('base64')));
  const kek = Buffer.from(kekText, 'base64');
  if (kek.length !== 32) throw new Error('CONNECTOR_KEK must be 32 bytes, base64-encoded');
  return {
    port: Number(process.env.PORT ?? service.port),
    publicUrl: (process.env.CONNECTOR_PUBLIC_URL ?? service.url).replace(/\/$/, ''),
    coreUrl: (process.env.CORE_URL ?? devService('api', 8000).url).replace(/\/$/, ''),
    databaseUrl: required('DATABASE_URL', () => `postgres://${name}:${name}@localhost:${postgresPort}/${name}`),
    kek,
    dataDir,
    production,
  };
}
