import { exportJWK, generateKeyPair, importJWK, SignJWT, type CryptoKey, type JWK } from 'jose';
type KeyLike = CryptoKey | Uint8Array;
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { env } from '../constants';

/**
 * The core's asymmetric signing key (Ed25519), published as a JWKS at `/.well-known/jwks.json`. Used for requests the
 * core sends to connectors, connector installation tokens and callback tokens (docs/plans/03). In deployed
 * environments the private JWK comes from `CORE_SIGNING_JWK` (secret manager / KMS later); locally it is generated
 * once into `.data/keys/core-signing.json`.
 */
export const CORE_ISSUER = 'fintivio-core';

interface KeyMaterial {
  kid: string;
  privateKey: KeyLike;
  publicJwk: JWK;
}

let material: Promise<KeyMaterial> | null = null;

async function load(): Promise<KeyMaterial> {
  let privateJwk: JWK;
  if (process.env.CORE_SIGNING_JWK) {
    privateJwk = JSON.parse(process.env.CORE_SIGNING_JWK);
  } else {
    const path = resolve(env.KEYS_DIR, 'core-signing.json');
    if (existsSync(path)) {
      privateJwk = JSON.parse(readFileSync(path, 'utf8'));
    } else {
      const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
      privateJwk = { ...(await exportJWK(privateKey)), kid: randomUUID(), alg: 'EdDSA' };
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(privateJwk), { mode: 0o600 });
    }
  }
  const kid = privateJwk.kid ?? 'core';
  const privateKey = (await importJWK({ ...privateJwk, alg: 'EdDSA' }, 'EdDSA')) as KeyLike;
  const { d: _d, ...publicJwk } = privateJwk;
  return { kid, privateKey, publicJwk: { ...publicJwk, kid, alg: 'EdDSA', use: 'sig' } };
}

export const signingKey = () => (material ??= load());

export async function jwks() {
  return { keys: [(await signingKey()).publicJwk] };
}

/** Sign a short-lived JWT as the core. */
export async function signAsCore(claims: Record<string, unknown>, options: { audience: string; subject?: string; expiresIn: string }) {
  const { kid, privateKey } = await signingKey();
  let jwt = new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA', kid }).setIssuer(CORE_ISSUER).setAudience(options.audience)
    .setIssuedAt().setJti(randomUUID()).setExpirationTime(options.expiresIn);
  if (options.subject) jwt = jwt.setSubject(options.subject);
  return jwt.sign(privateKey);
}

export const sha256Base64Url = (value: string) => createHash('sha256').update(value).digest('base64url');
