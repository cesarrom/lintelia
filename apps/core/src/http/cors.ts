import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import type { TenantDirectory } from '../services/tenant-directory.service';
import { env } from '../constants';

const CACHE_TTL_MS = 30_000;

/**
 * Browser origins allowed to call the API: the web app itself, every tenant sub-domain (`<tenant>.<BASE_DOMAIN>`),
 * every custom domain a tenant registered (`tenants.allowed_domains`, cached briefly) and CORS_ORIGINS.
 * A static list would lock out each newly onboarded institution.
 */
export function corsMiddleware(directory: TenantDirectory): MiddlewareHandler {
  const webHost = new URL(env.WEB_URL).host;
  const baseDomain = env.BASE_DOMAIN.toLowerCase();
  const explicit = new Set(env.CORS_ORIGINS.map((o) => o.trim().toLowerCase()).filter(Boolean));
  let tenantHosts = new Set<string>();
  let loadedAt = 0;

  const isAllowed = async (origin: string) => {
    let host: string;
    try {
      host = new URL(origin).host.toLowerCase();
    } catch {
      return false;
    }
    if (explicit.has(origin.toLowerCase()) || host === webHost || host.endsWith(`.${baseDomain}`)) return true;
    if (Date.now() - loadedAt > CACHE_TTL_MS) {
      tenantHosts = new Set(await directory.allHosts());
      loadedAt = Date.now();
    }
    return tenantHosts.has(host);
  };

  return async (c, next) => {
    const origin = c.req.header('origin');
    const allowedOrigin = origin && (await isAllowed(origin)) ? origin : '';
    return cors({
      origin: allowedOrigin,
      allowHeaders: ['Authorization', 'Content-Type', 'X-Tenant', 'X-Embed-Origin', 'Last-Event-ID'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    })(c, next);
  };
}
