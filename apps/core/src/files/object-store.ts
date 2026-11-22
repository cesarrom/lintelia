import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { env } from '../constants';

/**
 * Object storage port (docs/plans/07 §Ports and adapters). Local adapter: files on disk under OBJECT_STORE_DIR with
 * two areas, `quarantine/` (uploads before intake) and `clean/` (files that passed it); uploads and downloads go
 * through short-lived URLs signed by the API (the S3/Azure/GCS adapters would hand out presigned URLs instead).
 */
export interface ObjectStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  size(key: string): Promise<number | null>;
  move(from: string, to: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^(quarantine|clean)\/[0-9a-f-]{36}\/[0-9a-z._/-]+$/i;

export class LocalObjectStore implements ObjectStore {
  constructor(private readonly root = resolve(env.OBJECT_STORE_DIR)) { }

  private path(key: string) {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error(`Invalid object key ${key}`);
    return join(this.root, key);
  }

  async put(key: string, bytes: Uint8Array) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, bytes, { mode: 0o600 });
    await rename(`${path}.tmp`, path);
  }

  async get(key: string) {
    try {
      return await readFile(this.path(key));
    } catch {
      return null;
    }
  }

  async size(key: string) {
    try {
      return (await stat(this.path(key))).size;
    } catch {
      return null;
    }
  }

  async move(from: string, to: string) {
    const target = this.path(to);
    await mkdir(dirname(target), { recursive: true });
    await rename(this.path(from), target);
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
}

export const quarantineKey = (tenantId: string, uploadId: string) => `quarantine/${tenantId}/${uploadId}`;
export const cleanKey = (tenantId: string, fileId: string) => `clean/${tenantId}/files/${fileId}`;

// --- signed URLs -------------------------------------------------------------------------------------------------------

const signingKey = () => createHmac('sha256', env.AUTH_JWT_SECRET).update('object-store-urls').digest();

export function signToken(payload: Record<string, unknown>, ttlMs: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  return `${body}.${createHmac('sha256', signingKey()).update(body).digest('base64url')}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | undefined | null): T | null {
  const [body, mac] = String(token ?? '').split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', signingKey()).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
  return payload.exp > Date.now() ? payload : null;
}
