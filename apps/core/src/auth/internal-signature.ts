import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../constants';

/**
 * Authenticates calls from the API to its own durable handlers through the Restate ingress. The signature binds the
 * tenant and the case, and does not expire, because Restate replays the original request headers on every retry
 * (an expiring token would break long-running executions).
 */
const key = () => createHmac('sha256', env.AUTH_JWT_SECRET).update('restate-internal').digest();

export const internalSignature = (...parts: string[]) => createHmac('sha256', key()).update(parts.join(':')).digest('hex');

export const verifyInternalSignature = (signature: string | null | undefined, ...parts: string[]) => {
  if (!signature) return false;
  const expected = Buffer.from(internalSignature(...parts));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

export const INTERNAL_SIGNATURE_HEADER = 'x-fintivio-signature';
