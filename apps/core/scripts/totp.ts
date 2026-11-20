/**
 * Current TOTP code for a secret (default: the seeded staff account's development secret), e.g. to sign in as
 * staff@lintelia.local locally: `bun run totp` (or `bun run totp <base32 secret>`).
 */
import { currentStep, totpAt } from '../src/auth/mfa';

const secret = process.argv[2] || process.env.SEED_STAFF_TOTP_SECRET || 'LINTELIADEVSTAFFSECRETAAAAAAAAAA';
const step = currentStep();
const remaining = 30 - Math.floor((Date.now() / 1000) % 30);
console.log(`${totpAt(secret, step)}  (valid ${remaining}s more; next: ${totpAt(secret, step + 1)})`);
