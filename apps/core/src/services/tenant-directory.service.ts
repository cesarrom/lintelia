import { Inject, Injectable } from '@nestjs/common';
import { arrayContains, eq, or } from 'drizzle-orm';
import type { Tenant } from '@repo/fintivio/schemas';
import { tenants } from '../entities/globals';
import type { PlatformDatabase } from '../clients/database.client';
import { PLATFORM_CONNECTION } from '../injector/tokens/platform-connection.token';
import { env } from '../constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Looks tenants up before any tenant context exists (platform connection). Singleton. */
@Injectable()
export class TenantDirectory {
  constructor(@Inject(PLATFORM_CONNECTION) private readonly db: PlatformDatabase) { }

  /**
   * By tenant key (`domain`), by its platform sub-domain (`<key>.<BASE_DOMAIN>`) or by one of its custom host names
   * (`allowed_domains`).
   */
  async findByKey(key: string | null | undefined): Promise<Tenant | null> {
    const normalized = key?.trim().toLowerCase();
    if (!normalized) return null;
    const subdomainSuffix = `.${env.BASE_DOMAIN.toLowerCase()}`;
    const tenantKey = normalized.endsWith(subdomainSuffix) ? normalized.slice(0, -subdomainSuffix.length) : normalized;
    const [tenant] = await this.db.select().from(tenants)
      .where(or(eq(tenants.domain, tenantKey), arrayContains(tenants.allowedDomains, [normalized])))
      .limit(1);
    return tenant ?? null;
  }

  async findById(id: string): Promise<Tenant | null> {
    if (!UUID_RE.test(id)) return null;
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant ?? null;
  }

  /** Every custom host name registered by an active tenant. */
  async allHosts(): Promise<string[]> {
    const rows = await this.db.select({ hosts: tenants.allowedDomains }).from(tenants).where(eq(tenants.status, 'active'));
    return rows.flatMap((row) => row.hosts);
  }

  matches(tenant: Tenant, key: string) {
    const normalized = key.trim().toLowerCase();
    return tenant.domain === normalized
      || normalized === `${tenant.domain}.${env.BASE_DOMAIN.toLowerCase()}`
      || tenant.allowedDomains.includes(normalized);
  }
}
