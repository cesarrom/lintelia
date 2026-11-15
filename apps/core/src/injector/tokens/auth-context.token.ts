import { REQUEST } from '@nestjs/core';
import { ANONYMOUS, type AuthContext } from '../../auth/auth-context';

/** The authentication context resolved for the current request (see IdentityService.resolve). */
export const AUTH_CONTEXT = Symbol.for('AUTH_CONTEXT');
export const AUTH_CONTEXT_PROVIDER = {
  provide: AUTH_CONTEXT,
  inject: [REQUEST],
  useFactory: (req: { auth?: AuthContext } | undefined): AuthContext => req?.auth ?? ANONYMOUS,
};
