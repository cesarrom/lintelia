import { AbstractService } from "./service";
import { User } from "@repo/fintivio/schemas";
import { Injectable, Inject, Scope } from "@nestjs/common";
import { AUTH } from "../injector/tokens/auth.token";
import { type AppAuth } from "../clients/auth.client";
import { AuthorizationObject, decodeAuthorization } from "@repo/fintivio/utilities";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
@Injectable({
  scope: Scope.REQUEST
})
export class WebService extends AbstractService {
  private _mockUserId: string | null = null;
  private _sessionJWT: string | null = null;
  private body: AuthorizationObject | null = null;
  constructor(
    @Inject(AUTH) private auth: AppAuth,
    @Inject(REQUEST_PROXY) private requestProxy: AppRequest
  ) {
    super();
  }

  extractFromJsonLike(jsonString: string) {
    // match "token": "{token}" taking "\" into account optionally
    const token = jsonString.match(/\\?"token\\?":\s?\\?"([^"]+)\\?"/i)?.[1];

    // match "tenant": "{tenant}" taking "\" into account optionally
    const tenant = jsonString.match(/\\?"tenant\\?":\s?\\?"([^"]+)\\?"/i)?.[1];

    // match "domain": "{domain}" taking "\" into account optionally
    const domain = jsonString.match(/\\?"domain\\?":\s?\\?"([^"]+)\\?"/i)?.[1];

    return { token, tenant, domain };

  }

  private async getBody() {
    if (this.body?.tenant) {
      return this.body;
    }

    const idempotencyKey = this.requestProxy.headers.get('idempotency-key') || this.requestProxy.headers.get('register-key');

    if (!idempotencyKey) throw new Error('no key found');

    const decoded = decodeAuthorization(idempotencyKey);

    if (decoded.token && decoded.tenant) {
      this.body = { ...decoded };
    } else {

      const request = await this.requestProxy.copy();

      const rawBody = await request.text();

      const parsed = this.extractFromJsonLike(rawBody || '{}');
      this.body = { ...decoded, ...parsed, tenant: decoded.tenant || parsed.domain || parsed.tenant };
    }
    return this.body;
  }

  parseJsonOrDefault<T>(jsonTxt: string): T {
    try {
      return JSON.parse(jsonTxt) as T;
    } catch (e) {
      console.error(e, {
        jsonTxt
      })
      return {} as T;
    }
  }

  mockUserId(userId: string) {
    this._mockUserId = userId;
  }

  mockSessionJWT(token: string) {
    this._sessionJWT = token;
  }

  async getTenantAndDomain() {

    if (!this.requestProxy) {
      return { tenant: null, domain: null };
    }

    const { tenant: domain } = await this.getBody();

    return { domain };
  }

  async getSessionJWT() {
    if (this._sessionJWT) {
      return this._sessionJWT;
    }

    const { token } = await this.getBody();

    return token || null;
  }

  async getUserId() {
    if (this._mockUserId) {
      return this._mockUserId;
    }

    const jwt = await this.getSessionJWT();

    if (!jwt) {
      return null;
    }

    const info = await this.auth.validateJwt(jwt);

    return info?.token?.sub || null;
  }

  async getSessionUser(): Promise<User | null> {
    const userId = await this.getUserId();

    if (!userId) {
      return null;
    }

    const user = await this.auth.management.user.loadByUserId(userId);

    return user?.data || null;
  }
}