import { Inject, Injectable, Scope } from "@nestjs/common";
import type { User } from "@repo/fintivio/schemas";
import { AbstractService } from "./service";
import type { AuthContext } from "../auth/auth-context";
import { AUTH_CONTEXT } from "../injector/tokens/auth-context.token";

/**
 * Convenience accessors for the caller of the current request. The context itself is resolved (and the token
 * verified) before the request reaches Nest — see IdentityService.resolve.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class WebService extends AbstractService {
  constructor(@Inject(AUTH_CONTEXT) private readonly auth: AuthContext) {
    super();
  }

  async getTenantAndDomain() {
    return { tenant: this.auth.tenant, domain: this.auth.tenant?.domain ?? this.auth.requestedTenant };
  }

  async getSessionJWT() {
    return this.auth.token;
  }

  async getUserId() {
    return this.auth.user?.userId ?? null;
  }

  async getSessionUser(): Promise<User | null> {
    return this.auth.user;
  }
}
