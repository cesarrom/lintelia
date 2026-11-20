import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { customDomains, tenants } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { env } from '../constants';
import { AuditWriter } from './audit.writer';
import { TenantDirectory } from './tenant-directory.service';
import { BadRequestError, ConflictError, NotFoundError, UnprocessableError } from '../http/errors';

const HOSTNAME = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const challengeName = (hostname: string) => `_lintelia-challenge.${hostname}`;

/** DNS TXT lookup: real DNS in production, a DNS-over-HTTPS JSON endpoint otherwise (fake-services/dns locally). */
export async function lookupTxt(name: string): Promise<string[]> {
  if (env.DNS_RESOLVER === 'system') {
    try {
      return (await resolveTxt(name)).map((parts) => parts.join(''));
    } catch {
      return [];
    }
  }
  const response = await fetch(`${env.DNS_HTTP_URL}?name=${encodeURIComponent(name)}&type=TXT`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) return [];
  const body = await response.json() as { Answer?: Array<{ data: string }> };
  return (body.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ''));
}

/**
 * Custom host names (FIA-03, docs/plans/09): ownership is proven with a TXT record before the host serves the
 * institution; one host belongs to one institution. TLS and edge routing are the edge provider's part (planned).
 */
@Injectable({ scope: Scope.REQUEST })
export class CustomDomainsService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  private present(row: typeof customDomains.$inferSelect) {
    return {
      hostname: row.hostname, status: row.status, failureReason: row.failureReason, lastCheckedAt: row.lastCheckedAt, verifiedAt: row.verifiedAt, createdAt: row.createdAt,
      verification: { type: 'TXT', name: challengeName(row.hostname), value: row.verificationToken },
      routing: { type: 'CNAME', name: row.hostname, value: env.CUSTOM_DOMAIN_TARGET },
    };
  }

  async list() {
    const rows = await this.databases.platform.select().from(customDomains).where(eq(customDomains.tenantId, this.tenant.id));
    return rows.map((r) => this.present(r));
  }

  async add(input: { hostname?: string }) {
    const hostname = String(input.hostname ?? '').trim().toLowerCase().replace(/\.$/, '');
    if (!HOSTNAME.test(hostname) || hostname.endsWith('.localhost')) throw new BadRequestError('Enter a host name, e.g. onboarding.yourbank.com');
    const [taken] = await this.databases.platform.select({ tenantId: customDomains.tenantId }).from(customDomains).where(eq(customDomains.hostname, hostname)).limit(1);
    const owner = await this.directory.findByKey(hostname);
    if ((taken && taken.tenantId !== this.tenant.id) || (owner && owner.id !== this.tenant.id)) throw new ConflictError('This host name belongs to another institution');
    if (taken) throw new ConflictError('This host name is already added');
    const [row] = await this.databases.platform.insert(customDomains).values({
      tenantId: this.tenant.id, hostname, verificationToken: `lintelia-verify=${randomBytes(16).toString('hex')}`, createdByEmail: this.user.email,
    }).returning();
    await this.audit.record(this.tenant.id, this.actor, 'domain.added', { type: 'domain', id: row.id, hostname });
    return this.present(row);
  }

  private async load(hostname: string) {
    const [row] = await this.databases.platform.select().from(customDomains)
      .where(and(eq(customDomains.tenantId, this.tenant.id), eq(customDomains.hostname, hostname.toLowerCase()))).limit(1);
    if (!row) throw new NotFoundError('Domain not found');
    return row;
  }

  /** Check the TXT record; on success the host serves the institution. */
  async verify(hostname: string) {
    const row = await this.load(hostname);
    const records = await lookupTxt(challengeName(row.hostname));
    const ok = records.includes(row.verificationToken);
    const [updated] = await this.databases.platform.update(customDomains).set({
      lastCheckedAt: new Date(),
      ...(ok ? { status: 'active' as const, verifiedAt: row.verifiedAt ?? new Date(), failureReason: null } : { failureReason: `TXT record ${challengeName(row.hostname)} not found` }),
    }).where(eq(customDomains.id, row.id)).returning();
    if (!ok) throw new UnprocessableError(`The TXT record ${challengeName(row.hostname)} was not found (DNS changes can take a few minutes)`, [challengeName(row.hostname)]);
    await this.databases.platform.update(tenants).set({ allowedDomains: sql`array(select distinct unnest(${tenants.allowedDomains} || array[${row.hostname}]::text[]))` })
      .where(eq(tenants.id, this.tenant.id));
    await this.audit.record(this.tenant.id, this.actor, 'domain.verified', { type: 'domain', id: row.id, hostname: row.hostname });
    return this.present(updated);
  }

  async remove(hostname: string) {
    const row = await this.load(hostname);
    await this.databases.platform.delete(customDomains).where(eq(customDomains.id, row.id));
    await this.databases.platform.update(tenants).set({ allowedDomains: sql`array_remove(${tenants.allowedDomains}, ${row.hostname})` }).where(eq(tenants.id, this.tenant.id));
    await this.audit.record(this.tenant.id, this.actor, 'domain.removed', { type: 'domain', id: row.id, hostname: row.hostname });
  }

  /** Hosts another institution already uses (allowed domains set by staff, or verified custom domains). */
  static async conflicts(databases: Databases, tenantId: string, hostnames: string[]) {
    if (!hostnames.length) return [];
    const others = await databases.platform.select({ hosts: tenants.allowedDomains }).from(tenants).where(ne(tenants.id, tenantId));
    const claimed = await databases.platform.select({ hostname: customDomains.hostname }).from(customDomains).where(ne(customDomains.tenantId, tenantId));
    const taken = new Set([...others.flatMap((o) => o.hosts.map((h) => h.toLowerCase())), ...claimed.map((c) => c.hostname)]);
    return hostnames.filter((h) => taken.has(h.toLowerCase()));
  }
}
