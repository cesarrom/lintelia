import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../constants';

/**
 * Encryption of the few secrets the core itself must be able to use (webhook signing secrets): AES-256-GCM with the
 * data encryption key, `DATA_ENCRYPTION_KEY` (32 bytes, base64; a KMS-backed key in deployed environments) or a
 * local key generated once into `.data/keys/data-encryption.key`. Ciphertexts are `v1.<iv>.<tag>.<data>` (base64url)
 * and bound to a context string (AAD) so a ciphertext cannot be moved to another row.
 */
let key: Buffer | null = null;

function dataKey(): Buffer {
  if (key) return key;
  let text = process.env.DATA_ENCRYPTION_KEY;
  if (!text) {
    if (env.NODE_ENV === 'production') throw new Error('DATA_ENCRYPTION_KEY is required in production');
    const path = resolve(env.KEYS_DIR, 'data-encryption.key');
    if (!existsSync(path)) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, randomBytes(32).toString('base64'), { mode: 0o600 });
    }
    text = readFileSync(path, 'utf8').trim();
  }
  const decoded = Buffer.from(text, 'base64');
  if (decoded.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  key = decoded;
  return key;
}

export function encryptSecret(plaintext: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptSecret(ciphertext: string, context: string): string {
  const [version, iv, tag, data] = ciphertext.split('.');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unknown ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
