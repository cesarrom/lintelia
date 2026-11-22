import { Scope, Inject, Controller, Get, Post, Res } from "@nestjs/common";
import type { Context } from "hono";
import type { AfterLoginRequest, AfterLoginResponse, Tenant, User } from "@repo/lintelia/schemas";
import { TriggerBuilder } from "@repo/lintelia/utilities";
import { LogsService } from "../services/logs.service";
import { RolesService } from "../services/roles.service";
import { PublicFormsService } from "../services/public-forms.service";
import { TenantDirectory } from "../services/tenant-directory.service";
import { IdentityService, AuthError, isMfaChallenge, type SignInResult } from "../auth/identity.service";
import { env } from "../constants";
import { acceptPartyInvitation } from "../services/parties.service";
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from "../engine/engine.client";
import type { CaseRepository } from "../engine/case-repository";
import { AuditWriter } from "../services/audit.writer";
import { OneTimeSecrets } from "../auth/session.store";
import { redis } from "../clients/redis.client";
import { ClientProvisioningService } from "../client-apps/provisioning.service";

const REFRESH_COOKIE = 'lintelia_refresh';
import { Access, Public } from "../auth/access";
import type { AuthContext } from "../auth/auth-context";
import { AUTH_CONTEXT } from "../injector/tokens/auth-context.token";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
import { json, jsonError } from "../http/respond";

/** Public projection of a tenant (branding), safe to show before sign-in. */
const publicTenant = (tenant: Tenant) => ({
  id: tenant.id,
  domain: tenant.domain,
  name: tenant.name,
  logoUrl: tenant.logoUrl,
  pallette: tenant.pallette,
});

@Controller({
  path: '/auth',
  scope: Scope.REQUEST
})
export class AuthHandler {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(RolesService) private readonly rolesService: RolesService,
    @Inject(PublicFormsService) private readonly publicForms: PublicFormsService,
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(ClientProvisioningService) private readonly provisioning: ClientProvisioningService,
  ) { }

  private readonly partySecrets = new OneTimeSecrets(redis());

  /** The tenant named by `x-tenant`; 404 when the header is present but unknown. */
  private requireRequestedTenant(optional = false): Tenant | null {
    if (this.auth.requestedTenant && !this.auth.tenant) throw new AuthError('Unknown tenant', 404);
    if (!this.auth.tenant && !optional) throw new AuthError('A tenant is required (x-tenant header)', 400);
    return this.auth.tenant;
  }

  /** Session responses also set the refresh token as an HttpOnly cookie (same-site deployments). */
  private sendSession(ctx: Context, session: SignInResult, tenant: Tenant | null, status = 200, extra: Record<string, unknown> = {}) {
    // Password accepted but the second factor is still needed: no session yet, only the challenge.
    if (isMfaChallenge(session)) return json(ctx, { ...session, tenant: tenant ? publicTenant(tenant) : null }, 200);
    json(ctx, { ...session, tenant: tenant ? publicTenant(tenant) : null, ...extra }, status);
    ctx.res.headers.append('Set-Cookie', `${REFRESH_COOKIE}=${session.refreshToken}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=${env.AUTH_SESSION_TTL_SECONDS}`);
  }

  /** Sign in. With a tenant (`x-tenant`): members and clients of that tenant. Without: platform staff. */
  @Public()
  @Post('/login')
  async login(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant(true);
      const { email, password } = await this.request.json<{ email: string; password: string }>();
      this.sendSession(ctx, await this.identity.login(tenant, email, password), tenant);
    } catch (error) {
      jsonError(ctx, error, 'Sign-in failed');
    }
  }

  /** New access token from a refresh token (body `refreshToken` or the HttpOnly cookie). Rotates the refresh token. */
  @Public()
  @Post('/refresh')
  async refresh(@Res() ctx: Context) {
    try {
      const body = await this.request.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));
      const cookie = this.request.headers.get('cookie')?.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`))?.[1];
      const session = await this.identity.refresh(body.refreshToken ?? cookie);
      const tenant = session.user.kind === 'staff' ? null : await this.directory.findByKey(session.user.userTenants[0]?.tenantId);
      this.sendSession(ctx, session, tenant);
    } catch (error) {
      jsonError(ctx, error, 'Session expired', 401);
    }
  }

  /** End the current session on the server. */
  @Access('staff', 'member', 'client')
  @Post('/logout')
  async logout(@Res() ctx: Context) {
    await this.identity.logout(this.auth.claims);
    ctx.res = new Response(null, { status: 204, headers: { 'Set-Cookie': `${REFRESH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=0` } });
  }

  /** Always 202, whether or not the account exists. */
  @Public()
  @Post('/password/forgot')
  async forgotPassword(@Res() ctx: Context) {
    const tenant = this.auth.tenant;
    const { email } = await this.request.json<{ email: string }>().catch(() => ({ email: '' }));
    await this.identity.forgotPassword(tenant, email).catch((error) => console.error('forgot password', error));
    json(ctx, { status: 'accepted' }, 202);
  }

  @Public()
  @Post('/password/reset')
  async resetPassword(@Res() ctx: Context) {
    try {
      const { token, password } = await this.request.json<{ token: string; password: string }>();
      await this.identity.resetPassword(token, password);
      ctx.res = new Response(null, { status: 204 });
    } catch (error) {
      jsonError(ctx, error, 'Password reset failed');
    }
  }

  @Access('staff', 'member', 'client')
  @Post('/password/change')
  async changePassword(@Res() ctx: Context) {
    try {
      const { currentPassword, newPassword } = await this.request.json<{ currentPassword: string; newPassword: string }>();
      await this.identity.changePassword(this.auth, currentPassword, newPassword);
      ctx.res = new Response(null, { status: 204 });
    } catch (error) {
      jsonError(ctx, error, 'Password change failed');
    }
  }

  /** Passwordless sign-in for clients: e-mail a one-time code. Always 202. */
  @Public()
  @Post('/otp/start')
  async startOtp(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant()!;
      const { email } = await this.request.json<{ email: string }>();
      await this.identity.startOtp(tenant, email);
      json(ctx, { status: 'sent' }, 202);
    } catch (error) {
      jsonError(ctx, error, 'Could not send the code');
    }
  }

  @Public()
  @Post('/otp/verify')
  async verifyOtp(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant()!;
      const { email, code, profile, consents } = await this.request.json<{ email: string; code: string; profile?: Record<string, unknown>; consents?: Array<{ key?: string; version?: string }> }>();
      const { created, ...session } = await this.identity.verifyOtp(tenant, email, code);
      // A new client (first code): what the app's sign-up asked for, then the workflows listening to client.registered.
      if (created) await this.provisioning.afterSignUp(session.user.userId, { profile, consents, method: 'email_code' }).catch((e) => console.error('client.registered failed', e));
      // A confirmed e-mail also confirms the applications submitted with it (embedded forms).
      const submitted = session.user.kind === 'client' ? await this.publicForms.submitDrafts(tenant, session.user) : [];
      this.sendSession(ctx, session, tenant, 200, { firstSeen: created, submittedCases: submitted });
    } catch (error) {
      jsonError(ctx, error, 'Verification failed');
    }
  }

  /** Self-registration of a client (end user) of the tenant. */
  @Public()
  @Post('/register')
  async register(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant()!;
      const body = await this.request.json<{ email: string; password: string; name?: string; profile?: Record<string, unknown>; consents?: Array<{ key?: string; version?: string }> }>();
      await this.provisioning.checkSignUp(body.consents);
      const session = await this.identity.registerClient(tenant, body);
      await this.provisioning.afterSignUp(session.user.userId, { profile: body.profile, consents: body.consents, method: 'password' }).catch((e) => console.error('client.registered failed', e));
      this.sendSession(ctx, session, tenant, 201);
    } catch (error) {
      jsonError(ctx, error, 'Registration failed');
    }
  }

  /** Accept an invitation (or password reset link): set the password and sign in. */
  @Public()
  @Post('/invitations/accept')
  async acceptInvitation(@Res() ctx: Context) {
    try {
      // On the platform host (no tenant): a staff invitation.
      const tenant = this.requireRequestedTenant(true);
      const body = await this.request.json<{ token: string; password: string; name?: string }>();
      this.sendSession(ctx, tenant ? await this.identity.acceptInvitation(tenant, body) : await this.identity.acceptStaffInvitation(body), tenant);
    } catch (error) {
      jsonError(ctx, error, 'Accepting the invitation failed');
    }
  }

  // --- second factor --------------------------------------------------------------------------------------------

  /** `{ enrollmentToken }` → a new TOTP secret (`otpauthUri` for authenticator apps). */
  @Public()
  @Post('/mfa/totp/enroll')
  async enrollTotp(@Res() ctx: Context) {
    try {
      const { enrollmentToken } = await this.request.json<{ enrollmentToken: string }>();
      json(ctx, await this.identity.enrollTotp(enrollmentToken));
    } catch (error) {
      jsonError(ctx, error, 'Enrolment failed');
    }
  }

  /** `{ enrollmentToken, code }` → the session and the recovery codes (shown once). */
  @Public()
  @Post('/mfa/totp/confirm')
  async confirmTotp(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant(true);
      const { enrollmentToken, code } = await this.request.json<{ enrollmentToken: string; code: string }>();
      const { recoveryCodes, ...session } = await this.identity.confirmTotp(enrollmentToken, code);
      this.sendSession(ctx, session, tenant, 200, { recoveryCodes });
    } catch (error) {
      jsonError(ctx, error, 'Enrolment failed');
    }
  }

  /** `{ mfaToken, code }` (authenticator code or a recovery code) → the session. */
  @Public()
  @Post('/mfa/verify')
  async verifyMfa(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant(true);
      const { mfaToken, code } = await this.request.json<{ mfaToken: string; code: string }>();
      this.sendSession(ctx, await this.identity.verifyMfa(mfaToken, code), tenant);
    } catch (error) {
      jsonError(ctx, error, 'Verification failed');
    }
  }

  /** `{ token }` from a party invitation (co-applicant, guarantor, UBO…): single use; signs the person in. */
  @Public()
  @Post('/party-invitations/accept')
  async acceptPartyInvitation(@Res() ctx: Context) {
    try {
      const tenant = this.requireRequestedTenant();
      const { token } = await this.request.json<{ token: string }>();
      const { session, caseId, role } = await acceptPartyInvitation({ repository: this.repository, engine: this.engine, identity: this.identity, audit: this.audit, secrets: this.partySecrets }, tenant!, token);
      this.sendSession(ctx, session, tenant, 200, { caseId, role });
    } catch (error) {
      jsonError(ctx, error, 'Joining failed');
    }
  }

  /** What the client app's sign-up asks for (profile fields, consents); `available: false` without a published app. */
  @Public()
  @Get('/client/registration')
  async clientRegistration(@Res() ctx: Context) {
    try {
      this.requireRequestedTenant();
      json(ctx, await this.provisioning.registrationForm());
    } catch (error) {
      jsonError(ctx, error, 'Could not load the sign-up form');
    }
  }

  /** Sites allowed to frame the client app (`/embed/app`), for the web server's frame-ancestors policy. */
  @Public()
  @Get('/client/embed-policy')
  async clientEmbedPolicy(@Res() ctx: Context) {
    try {
      this.requireRequestedTenant();
      json(ctx, await this.provisioning.embedPolicy());
    } catch {
      json(ctx, { frameAncestors: [] });
    }
  }

  /** Branding of a tenant by key or host name, for the sign-in page. */
  @Public()
  @Get('/tenant')
  async tenant(@Res() ctx: Context) {
    const key = new URL(this.request.url).searchParams.get('domain') ?? this.auth.requestedTenant;
    const tenant = await this.directory.findByKey(key);
    if (!tenant || tenant.status !== 'active') return json(ctx, { error: 'Tenant not found' }, 404);
    json(ctx, publicTenant(tenant));
  }

  @Access('staff', 'member', 'client')
  @Get('/me')
  async me(@Res() ctx: Context) {
    json(ctx, { user: this.auth.user, tenant: this.auth.tenant ? publicTenant(this.auth.tenant) : null, permissions: this.auth.user?.permissions ?? [] });
  }

  @Access('member', 'client')
  @Get('/roles')
  async getUserRoles(@Res() ctx: Context) {
    const user = this.auth.user as User;
    json(ctx, await this.rolesService.getRolesByUserId({ userId: user.userId }));
  }

  /** Records the sign-in/sign-up event (which can trigger workflows) and tells the web app where to go. */
  @Access('staff', 'member', 'client')
  @Post('/after-login')
  async afterLogin(@Res() ctx: Context) {
    const user = this.auth.user as User;
    if (!this.auth.tenant) {
      return json(ctx, { redirectPath: '/app/platform/institutions' } satisfies AfterLoginResponse);
    }

    const { firstSeen } = await this.request.json<AfterLoginRequest>().catch(() => ({ firstSeen: false }));
    const eventName = firstSeen ? TriggerBuilder.Events.USER_SIGNUP : TriggerBuilder.Events.USER_SIGNIN;
    await this.logsService.info(eventName, {
      category: TriggerBuilder.Categories.SECURITY,
      source: TriggerBuilder.Sources.AUTH,
      userId: user.userId,
      metadata: { eventName, firstSeen, tenant: this.auth.tenant.domain, email: user.email, userId: user.userId },
    });

    json(ctx, { redirectPath: user.kind === 'client' ? '/portal' : '/app/dashboard' } satisfies AfterLoginResponse);
  }
}
