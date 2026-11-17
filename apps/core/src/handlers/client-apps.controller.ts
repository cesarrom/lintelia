import { Controller, Delete, Get, Inject, Param, Patch, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant } from '@repo/fintivio/schemas';
import { Access, Public, Require, RequireAny } from '../auth/access';
import { AUTH_CONTEXT } from '../injector/tokens/auth-context.token';
import type { AuthContext } from '../auth/auth-context';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle, json, jsonError } from '../http/respond';
import { AuthError } from '../auth/identity.service';
import { ClientAppsService } from '../client-apps/studio.service';
import { ClientRuntimeService } from '../client-apps/runtime.service';
import { ClientProvisioningService } from '../client-apps/provisioning.service';

const publicTenant = (tenant: Tenant) => ({ id: tenant.id, domain: tenant.domain, name: tenant.name, logoUrl: tenant.logoUrl, pallette: tenant.pallette });

/** The studio: the institution's client app (docs/plans/11). */
@Controller({ path: '/client-apps', scope: Scope.REQUEST })
export class ClientAppsHandler {
  constructor(
    @Inject(ClientAppsService) private readonly apps: ClientAppsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('experience:read')
  @Get('/current')
  current(@Res() ctx: Context) {
    return handle(ctx, () => this.apps.current(), 'Failed to load the client app');
  }

  @Require('experience:manage')
  @Put('/current/draft')
  save(@Res() ctx: Context) {
    return handle(ctx, async () => this.apps.saveDraft(await this.request.json()), 'Failed to save the draft');
  }

  @Require('experience:read')
  @Post('/current/validate')
  validate(@Res() ctx: Context) {
    return handle(ctx, async () => this.apps.validate(await this.request.json().catch(() => ({}))), 'Failed to validate');
  }

  @Require('experience:publish')
  @Post('/current/publish')
  publish(@Res() ctx: Context) {
    return handle(ctx, () => this.apps.publish(), 'Failed to publish');
  }

  /** `{ version }`: make an earlier version the active one (rollback). */
  @Require('experience:publish')
  @Post('/current/activate')
  activate(@Res() ctx: Context) {
    return handle(ctx, async () => this.apps.activate(Number((await this.request.json<{ version?: number }>()).version)), 'Failed to activate the version');
  }

  @Require('experience:read')
  @Get('/current/versions/:version')
  version(@Param('version') version: string, @Res() ctx: Context) {
    return handle(ctx, () => this.apps.version(Number(version)), 'Failed to load the version');
  }

  @Require('experience:read')
  @Get('/templates')
  templates(@Res() ctx: Context) {
    json(ctx, this.apps.templates());
  }

  @Require('experience:manage')
  @Post('/current/template')
  install(@Res() ctx: Context) {
    return handle(ctx, async () => this.apps.installTemplate(await this.request.json()), 'Failed to install the template');
  }

  /** `{ clientId, sources, definition? }`: a client's data as the draft would show it. */
  @Require('experience:read')
  @Post('/current/preview')
  preview(@Res() ctx: Context) {
    return handle(ctx, async () => this.apps.preview(await this.request.json()), 'Failed to preview');
  }
}

/** The signed-in client's app: what it shows, its data, journeys, profile and notifications. */
@Access('client')
@Controller({ path: '/me/app', scope: Scope.REQUEST })
export class ClientRuntimeHandler {
  constructor(
    @Inject(ClientRuntimeService) private readonly runtime: ClientRuntimeService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Get()
  app(@Res() ctx: Context) {
    return handle(ctx, () => this.runtime.app(), 'Failed to load the app');
  }

  /** `{ sources: ['me', 'records:accounts', ...] }` */
  @Post('/data')
  data(@Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.data(await this.request.json()), 'Failed to load your data');
  }

  @Post('/journeys/:key/start')
  start(@Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.startJourney(key, await this.request.json().catch(() => ({}))), 'Failed to start', 201);
  }

  @Get('/cases/:caseId/journey')
  journey(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.runtime.journey(caseId), 'Failed to load');
  }

  /** `{ event, values }`: the button pressed and the answers. */
  @Post('/cases/:caseId/screens/:taskId')
  submit(@Param('caseId') caseId: string, @Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.submitScreen(caseId, taskId, await this.request.json()), 'Failed to send');
  }

  @Patch('/profile')
  profile(@Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.updateProfile(await this.request.json()), 'Failed to save your details');
  }

  @Post('/consents')
  consents(@Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.acceptConsents(await this.request.json()), 'Failed to record your consent');
  }

  @Post('/notifications/read')
  readAll(@Res() ctx: Context) {
    return handle(ctx, () => this.runtime.readNotifications(), 'Failed');
  }

  @Post('/notifications/:id/read')
  read(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.runtime.readNotifications(id), 'Failed');
  }
}

/**
 * The institution's systems and team: register clients and open sessions for embedded apps (`clients:provision`),
 * push the data clients see (`clients:records`). A client is its id or `ext:<externalId>`.
 */
@Controller({ path: '/clients', scope: Scope.REQUEST })
export class ClientDataHandler {
  constructor(
    @Inject(ClientProvisioningService) private readonly provisioning: ClientProvisioningService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @RequireAny('clients:read', 'clients:provision')
  @Get('/:client/profile')
  profile(@Param('client') client: string, @Res() ctx: Context) {
    return handle(ctx, () => this.provisioning.profile(client), 'Failed to load the profile');
  }

  @Require('clients:provision')
  @Patch('/:client/profile')
  patchProfile(@Param('client') client: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.provisioning.patchProfile(client, await this.request.json()), 'Failed to update the profile');
  }

  @RequireAny('clients:read', 'clients:records')
  @Get('/:client/records')
  allRecords(@Param('client') client: string, @Res() ctx: Context) {
    return handle(ctx, () => this.provisioning.allRecords(client), 'Failed to list the records');
  }

  @RequireAny('clients:read', 'clients:records')
  @Get('/:client/records/:collection')
  records(@Param('client') client: string, @Param('collection') collection: string, @Res() ctx: Context) {
    return handle(ctx, () => this.provisioning.records(client, collection), 'Failed to list the records');
  }

  /** Bulk: `{ records: [{ key, data }], replace? }` */
  @Require('clients:records')
  @Put('/:client/records/:collection')
  putRecords(@Param('client') client: string, @Param('collection') collection: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.provisioning.putRecords(client, collection, await this.request.json()), 'Failed to write the records');
  }

  /** `{ data, merge? }` */
  @Require('clients:records')
  @Put('/:client/records/:collection/:key')
  putRecord(@Param('client') client: string, @Param('collection') collection: string, @Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.provisioning.putRecord(client, collection, key, await this.request.json()), 'Failed to write the record');
  }

  @Require('clients:records')
  @Delete('/:client/records/:collection/:key')
  deleteRecord(@Param('client') client: string, @Param('collection') collection: string, @Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, () => this.provisioning.deleteRecord(client, collection, key), 'Failed to delete the record');
  }
}

/** `POST /client-sessions`: upsert a client from the institution's backend and get a single-use client secret for the SDK. */
@Controller({ path: '/client-sessions', scope: Scope.REQUEST })
export class ClientSessionsHandler {
  constructor(
    @Inject(ClientProvisioningService) private readonly provisioning: ClientProvisioningService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('clients:provision')
  @Post()
  create(@Res() ctx: Context) {
    return handle(ctx, async () => this.provisioning.createSession(await this.request.json()), 'Failed to create the client session', 201);
  }
}

/** Client sign-in for embedded apps: a client secret from the institution's backend, or a token of its identity provider. */
@Public()
@Controller({ path: '/auth/client', scope: Scope.REQUEST })
export class ClientAuthHandler {
  constructor(
    @Inject(ClientProvisioningService) private readonly provisioning: ClientProvisioningService,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  private tenant() {
    if (!this.auth.tenant) throw new AuthError('A tenant is required (x-tenant header)', 400);
    return this.auth.tenant;
  }

  /** `{ clientSecret }` → a client session (once). */
  @Post('/session')
  async session(@Res() ctx: Context) {
    try {
      const tenant = this.tenant();
      const { clientSecret } = await this.request.json<{ clientSecret?: string }>();
      json(ctx, { ...(await this.provisioning.exchangeSecret(String(clientSecret ?? ''))), tenant: publicTenant(tenant) });
    } catch (error) {
      jsonError(ctx, error, 'Sign-in failed');
    }
  }

  /** `{ subjectToken }`: a JWT of the institution's identity provider → a client session (token exchange). */
  @Post('/token')
  async token(@Res() ctx: Context) {
    try {
      const tenant = this.tenant();
      const { subjectToken } = await this.request.json<{ subjectToken?: string }>();
      json(ctx, { ...(await this.provisioning.exchangeToken(String(subjectToken ?? ''))), tenant: publicTenant(tenant) });
    } catch (error) {
      jsonError(ctx, error, 'Sign-in failed');
    }
  }
}
