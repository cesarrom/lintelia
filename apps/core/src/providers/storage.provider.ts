import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { env } from '../constants';

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Object storage. Keys are always namespaced by tenant by the caller (FilesService), so one tenant cannot address
 * another tenant's files. An S3-compatible adapter (AWS SDK v3) is the intended production implementation.
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
}

/** Stores objects on local disk under STORAGE_LOCAL_DIR (local development and tests). */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path;
  }

  async put(key: string, body: Uint8Array | Buffer, contentType: string) {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType }));
  }

  async get(key: string): Promise<StoredObject | null> {
    const path = this.pathFor(key);
    try {
      const [body, meta] = await Promise.all([
        readFile(path),
        readFile(`${path}.meta.json`, 'utf8').then(JSON.parse).catch(() => ({})),
      ]);
      return { body, contentType: meta.contentType ?? 'application/octet-stream' };
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }
}

export const STORAGE_PROVIDER = Symbol.for('STORAGE_PROVIDER');
export const STORAGE_PROVIDER_FACTORY = {
  provide: STORAGE_PROVIDER,
  useFactory: (): StorageProvider => new LocalStorageProvider(join(process.cwd(), env.STORAGE_LOCAL_DIR)),
};
