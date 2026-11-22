import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Sql } from 'postgres';

/**
 * Envelope encryption of vendor secrets (docs/plans/03 §Where vendor secrets live): each installation has its own
 * data key (AES-256), stored wrapped by the connector's key-encryption key; secrets are AES-256-GCM encrypted with
 * the data key. Deleting the data key crypto-shreds every secret of the installation. Values never leave the
 * connector: no endpoint returns them and the logger redacts them.
 */
const seal = (key: Buffer, plaintext: Buffer, aad: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, ciphertext, tag: cipher.getAuthTag() };
};

const open = (key: Buffer, sealed: { iv: Buffer; ciphertext: Buffer; tag: Buffer }, aad: string) => {
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(sealed.tag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
};

/** Values registered here are replaced by `[redacted]` in connector logs. */
const knownSecrets = new Set<string>();
export function redact(text: string) {
  let out = text;
  for (const secret of knownSecrets) if (secret.length >= 4) out = out.split(secret).join('[redacted]');
  return out;
}

export interface SecretInfo {
  name: string;
  setAt: Date;
}

export class SecretStore {
  constructor(private readonly sql: Sql, private readonly kek: Buffer, private readonly installationId: string) { }

  private async dataKey(create: boolean): Promise<Buffer | null> {
    const [row] = await this.sql`select wrapped from sdk_data_keys where installation_id = ${this.installationId}`;
    if (row) {
      const wrapped = Buffer.from(row.wrapped as Uint8Array);
      return open(this.kek, { iv: wrapped.subarray(0, 12), tag: wrapped.subarray(12, 28), ciphertext: wrapped.subarray(28) }, `dek:${this.installationId}`);
    }
    if (!create) return null;
    const key = randomBytes(32);
    const sealed = seal(this.kek, key, `dek:${this.installationId}`);
    await this.sql`insert into sdk_data_keys (installation_id, wrapped) values (${this.installationId}, ${Buffer.concat([sealed.iv, sealed.tag, sealed.ciphertext])})
      on conflict (installation_id) do nothing`;
    return (await this.dataKey(false))!;
  }

  async set(name: string, value: string) {
    const key = (await this.dataKey(true))!;
    const sealed = seal(key, Buffer.from(value, 'utf8'), `${this.installationId}:${name}`);
    await this.sql`insert into sdk_secrets (installation_id, name, ciphertext, iv, tag) values (${this.installationId}, ${name}, ${sealed.ciphertext}, ${sealed.iv}, ${sealed.tag})
      on conflict (installation_id, name) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, tag = excluded.tag, set_at = now()`;
    knownSecrets.add(value);
  }

  async get(name: string): Promise<string | null> {
    const [row] = await this.sql`select ciphertext, iv, tag from sdk_secrets where installation_id = ${this.installationId} and name = ${name}`;
    if (!row) return null;
    const key = await this.dataKey(false);
    if (!key) return null;
    const value = open(key, { iv: Buffer.from(row.iv), tag: Buffer.from(row.tag), ciphertext: Buffer.from(row.ciphertext) }, `${this.installationId}:${name}`).toString('utf8');
    knownSecrets.add(value);
    return value;
  }

  /** Names and dates only (what settings pages show: "•••• set 2 days ago"). */
  async list(): Promise<SecretInfo[]> {
    const rows = await this.sql`select name, set_at from sdk_secrets where installation_id = ${this.installationId} order by name`;
    return rows.map((r) => ({ name: r.name as string, setAt: r.set_at as Date }));
  }

  async delete(name: string) {
    await this.sql`delete from sdk_secrets where installation_id = ${this.installationId} and name = ${name}`;
  }

  /** Crypto-shredding: without the data key no secret of the installation can be decrypted any more. */
  async shred() {
    await this.sql`delete from sdk_data_keys where installation_id = ${this.installationId}`;
    await this.sql`delete from sdk_secrets where installation_id = ${this.installationId}`;
  }
}
