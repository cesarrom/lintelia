import { createRemoteJWKSet, exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type CryptoKey, type JWK, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { localSecretFile } from './env';

/**
 * The connector's signing key (Ed25519): it authenticates to the core's token endpoint with `private_key_jwt`
 * (RFC 7523) and publishes the public half at `/.well-known/jwks.json`. `CONNECTOR_SIGNING_JWK` in deployed
 * environments; generated once into `.data/connectors/<id>/signing.json` locally.
 */
export interface ConnectorKeys {
  kid: string;
  privateKey: CryptoKey | Uint8Array;
  publicJwk: JWK;
}

export async function loadConnectorKeys(dataDir: string, production: boolean): Promise<ConnectorKeys> {
  let text = process.env.CONNECTOR_SIGNING_JWK;
  if (!text) {
    if (production) throw new Error('CONNECTOR_SIGNING_JWK is required in production');
    const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
    const generated = JSON.stringify({ ...(await exportJWK(privateKey)), kid: randomUUID(), alg: 'EdDSA' });
    text = localSecretFile(dataDir, 'signing.json', () => generated);
  }
  const jwk = JSON.parse(text) as JWK;
  const kid = jwk.kid ?? 'connector';
  const { d: _d, ...publicJwk } = jwk;
  return { kid, privateKey: (await importJWK({ ...jwk, alg: 'EdDSA' }, 'EdDSA')) as CryptoKey, publicJwk: { ...publicJwk, kid, alg: 'EdDSA', use: 'sig' } };
}

export const TOKEN_ENDPOINT_AUDIENCE = 'fintivio-core';
export const CORE_ISSUER = 'fintivio-core';

export async function clientAssertion(keys: ConnectorKeys, connectorId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: 'EdDSA', kid: keys.kid }).setIssuer(connectorId).setSubject(connectorId)
    .setAudience(TOKEN_ENDPOINT_AUDIENCE).setIssuedAt().setJti(randomUUID()).setExpirationTime('60s').sign(keys.privateKey);
}

export const sha256Base64Url = (value: string) => createHash('sha256').update(value).digest('base64url');

/** Verifies tokens signed by the core (requests to the connector, callback tokens) with the core's JWKS. */
export class CoreKeys {
  private readonly jwks: JWTVerifyGetKey;

  constructor(coreUrl: string) {
    this.jwks = createRemoteJWKSet(new URL('/.well-known/jwks.json', coreUrl), { cacheMaxAge: 300_000, cooldownDuration: 5_000 });
  }

  async verify(token: string, audience: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.jwks, { issuer: CORE_ISSUER, audience, maxTokenAge: '10m' });
    return payload;
  }

  /** Claims of a callback token, without verifying it (the core verifies it when the connector uses it). */
  static peek(token: string): Record<string, unknown> {
    try {
      return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  }
}
