import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANONYMOUS, type AuthContext } from './auth-context';
import { AuditWriter } from '../services/audit.writer';

export type AccessLevel = 'public' | 'staff' | 'member' | 'client' | 'api_client';

const ACCESS_KEY = 'lintelia:access';
const MEMBER_PERMISSIONS_KEY = 'lintelia:member-permissions';
const PLATFORM_PERMISSIONS_KEY = 'lintelia:platform-permissions';
const ANY_PERMISSION_KEY = 'lintelia:any-member-permission';

/**
 * Route policies. Deny by default: a route with none of these decorators is refused.
 *
 *  - `@Public()`                      anyone
 *  - `@Access('client', ...)`         principals of these kinds, no permission needed (clients act on their own data;
 *                                     the service checks ownership; `member`/`api_client` routes whose rule lives on
 *                                     the resource, e.g. a workflow's start rule, check it in the service)
 *  - `@Require('cases:read', ...)`    institution members holding every listed permission
 *  - `@RequireAny('clients:read', 'clients:records')`  institution members (or API clients) holding one of them
 *  - `@RequirePlatform('platform.tenants:create', ...)`  platform staff holding every listed permission
 *
 * Policies combine with OR: e.g. `@Require('workspace:update') @RequirePlatform('platform.tenants:update')` lets
 * either an institution admin or authorised staff through. Conditions (case scope, segregation of duties) are
 * checked by the services.
 */
export const Access = (...levels: AccessLevel[]) => SetMetadata(ACCESS_KEY, levels);
export const Public = () => Access('public');
export const Require = (...permissions: string[]) => SetMetadata(MEMBER_PERMISSIONS_KEY, permissions);
export const RequireAny = (...permissions: string[]) => SetMetadata(ANY_PERMISSION_KEY, permissions);
export const RequirePlatform = (...permissions: string[]) => SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);

export const hasPermissions = (auth: AuthContext, permissions: string[]) =>
  !!auth.user && permissions.every((permission) => auth.user!.permissions.includes(permission));

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private meta<T>(key: string, context: ExecutionContext) {
    return this.reflector.getAllAndOverride<T>(key, [context.getHandler(), context.getClass()]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const levels = this.meta<AccessLevel[]>(ACCESS_KEY, context) ?? [];
    const memberPermissions = this.meta<string[]>(MEMBER_PERMISSIONS_KEY, context);
    const platformPermissions = this.meta<string[]>(PLATFORM_PERMISSIONS_KEY, context);
    const anyPermission = this.meta<string[]>(ANY_PERMISSION_KEY, context);

    if (levels.includes('public')) return true;
    if (!levels.length && !memberPermissions && !platformPermissions && !anyPermission) {
      // No policy declared: refuse (deny by default) rather than guess.
      throw new ForbiddenException('No access policy declared for this route');
    }

    const auth: AuthContext = context.switchToHttp().getRequest()?.auth ?? ANONYMOUS;
    if (!auth.claims || !auth.user) throw new UnauthorizedException();
    const kind = auth.claims.kind;

    if (kind === 'staff' && auth.supportGrant && auth.tenant) {
      // Support access: read-only member routes within the grant's permissions; every use lands in the institution's
      // audit log.
      const request = context.switchToHttp().getRequest();
      const method = String(request?.method ?? 'GET').toUpperCase();
      const granted = (memberPermissions && hasPermissions(auth, memberPermissions)) || (anyPermission && anyPermission.some((p) => hasPermissions(auth, [p])));
      if (method === 'GET' && granted) {
        await this.audit.record(auth.tenant.id, { type: 'staff', id: auth.user.userId, email: auth.user.email }, 'support_access.used',
          { type: 'support_grant', id: auth.supportGrant.id }, { method, path: new URL(request.url).pathname });
        return true;
      }
      throw new ForbiddenException('Support access is read-only');
    }
    if (levels.includes(kind as AccessLevel)) return true;
    // API clients (the institution's systems) use the same permission-based routes as members, within their grant.
    if ((kind === 'member' || kind === 'api_client') && memberPermissions && hasPermissions(auth, memberPermissions)) return true;
    if ((kind === 'member' || kind === 'api_client') && anyPermission && anyPermission.some((p) => hasPermissions(auth, [p]))) return true;
    if (kind === 'staff' && platformPermissions && hasPermissions(auth, platformPermissions)) return true;
    throw new ForbiddenException();
  }
}
