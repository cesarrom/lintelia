/** Password hashing with Bun's built-in argon2id implementation. */
export const hashPassword = (password: string) => Bun.password.hash(password, { algorithm: 'argon2id' });

export const verifyPassword = async (password: string, hash: string | null | undefined) => {
  if (!hash) return false;
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
};

export const MIN_PASSWORD_LENGTH = 10;

export class PasswordPolicyError extends Error {
  readonly status = 400;
}

export const assertPasswordPolicy = (password: unknown): string => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordPolicyError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  return password;
};
