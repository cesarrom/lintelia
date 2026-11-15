import { Controller, Get, Inject, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { Public, Require, RequirePlatform } from '../auth/access';
import { SsoService } from '../auth/sso/sso.service';
import type { AuthContext } from '../auth/auth-context';
import { AUTH_CONTEXT } from '../injector/tokens/auth-context.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { BadRequestError } from '../http/errors';
import { env, tenantWebUrl } from '../constants';
import { handle, json, jsonError } from '../http/respond';

const publicTenant = (tenant: Tenant) => ({ id: tenant.id, domain: tenant.domain, name: tenant.name, logoUrl: tenant.logoUrl, pallette: tenant.pallette });

/** The institution's single sign-on (security:manage): status at the broker, Admin Portal links, enforcement, JIT. */
@Controller({ path: '/sso', scope: Scope.REQUEST })
export class SsoHandler {
  constructor(
    @Inject(SsoService) private readonly sso: SsoService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  @Require('security:manage')
  @Get()
  status(@Res() ctx: Context) {
    return handle(ctx, () => this.sso.status(this.tenant), 'Failed to load single sign-on');
  }

  /** `{ intent: 'sso' | 'domain_verification' }` → `{ link }` to the broker's Admin Portal (short-lived). */
  @Require('security:manage')
  @Post('/setup-link')
  setupLink(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const { intent = 'sso' } = await this.request.json<{ intent?: 'sso' | 'domain_verification' | 'dsync' }>().catch(() => ({} as { intent?: 'sso' }));
      if (!['sso', 'domain_verification', 'dsync'].includes(intent)) throw new BadRequestError('intent must be sso, domain_verification or dsync');
      return this.sso.setupLink(this.tenant, intent, this.actor);
    }, 'Failed to create the setup link', 201);
  }

  /** `{ enforce?, jit?: { enabled, defaultRoles } }` */
  @Require('security:manage')
  @Put('/settings')
  settings(@Res() ctx: Context) {
    return handle(ctx, async () => this.sso.updateSettings(this.tenant, await this.request.json(), this.actor), 'Failed to update single sign-on');
  }
}

/** The sign-in side of SSO: discovery, the round trip through the broker, and the session hand-off. */
@Public()
@Controller({ path: '/auth/sso', scope: Scope.REQUEST })
export class SsoAuthHandler {
  constructor(
    @Inject(SsoService) private readonly sso: SsoService,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  private get query() {
    return new URL(this.request.url).searchParams;
  }

  @Get('/discover')
  discover(@Res() ctx: Context) {
    return handle(ctx, async () => {
      // Without an institution: platform staff (company IdP).
      if (!this.auth.requestedTenant) return this.sso.discoverStaff(this.query.get('email') ?? '');
      if (!this.auth.tenant) return { sso: false, enforce: false };
      return this.sso.discover(this.auth.tenant, this.query.get('email') ?? '');
    }, 'Discovery failed');
  }

  /** Browser navigation: `?tenant=&email=` → 302 to the broker. */
  @Get('/start')
  async start(@Res() ctx: Context) {
    const tenant = this.query.get('tenant') ?? '';
    try {
      const url = await this.sso.start(tenant, this.query.get('email') ?? '');
      ctx.res = new Response(null, { status: 302, headers: { Location: url } });
    } catch (error) {
      const back = tenant ? tenantWebUrl(tenant, '/sign-on') : new URL('/sign-on', env.WEB_URL).toString();
      ctx.res = new Response(null, { status: 302, headers: { Location: `${back}?sso_error=${encodeURIComponent((error as Error).message)}` } });
    }
  }

  /** The broker sends the browser back here with a code. */
  @Get('/callback')
  async callback(@Res() ctx: Context) {
    try {
      const target = await this.sso.callback(this.query.get('code') ?? '', this.query.get('state') ?? '');
      ctx.res = new Response(null, { status: 302, headers: { Location: target } });
    } catch (error) {
      ctx.res = new Response(null, { status: 302, headers: { Location: new URL(`/sign-on?sso_error=${encodeURIComponent((error as Error).message)}`, env.WEB_URL).toString() } });
    }
  }

  /** `{ code }` (the one-time hand-off) → the session. */
  @Post('/exchange')
  async exchange(@Res() ctx: Context) {
    try {
      const { code } = await this.request.json<{ code: string }>();
      const { session, tenant } = await this.sso.exchange(code);
      json(ctx, { ...session, tenant: tenant ? publicTenant(tenant) : null });
    } catch (error) {
      jsonError(ctx, error, 'Sign-in failed');
    }
  }
}

/** Single sign-on of platform staff through the company IdP (platform.staff:manage). */
@Controller({ path: '/platform/sso', scope: Scope.REQUEST })
export class PlatformSsoHandler {
  constructor(
    @Inject(SsoService) private readonly sso: SsoService,
    @Inject(USER) private readonly user: User,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @RequirePlatform('platform.staff:manage')
  @Get()
  status(@Res() ctx: Context) {
    return handle(ctx, () => this.sso.staffStatus(), 'Failed to load single sign-on');
  }

  @RequirePlatform('platform.staff:manage')
  @Post('/setup-link')
  setupLink(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const { intent = 'sso' } = await this.request.json<{ intent?: 'sso' | 'domain_verification' }>().catch(() => ({} as { intent?: 'sso' }));
      return this.sso.staffSetupLink(intent, this.user.email);
    }, 'Failed to create the setup link', 201);
  }

  @RequirePlatform('platform.staff:manage')
  @Put('/settings')
  settings(@Res() ctx: Context) {
    return handle(ctx, async () => this.sso.updateStaffSettings(await this.request.json(), this.user.email), 'Failed to update single sign-on');
  }
}
