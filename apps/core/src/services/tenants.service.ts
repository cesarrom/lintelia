import { Injectable, Inject, Scope } from "@nestjs/common";
import { asc, eq, notInArray } from "drizzle-orm";
import type { CNAMERecordResponse, CreateTenant, Tenant } from "@repo/fintivio/schemas";
import { AbstractService } from "./service";
import { tenants } from "../entities/globals";
import { cases, FINAL_CASE_STATUSES } from "../entities";
import { ENGINE_CLIENT, type EngineClient } from "../engine/engine.client";
import type { Databases } from "../clients/database.client";
import { DATABASES } from "../injector/tokens/databases.token";
import { AUTH_CONTEXT } from "../injector/tokens/auth-context.token";
import type { AuthContext } from "../auth/auth-context";
import { TenantDirectory } from "./tenant-directory.service";
import { DomainsService } from "./domains.service";
import { InvitationsService } from "./invitations.service";
import { provisionTenant, TenantProvisioningError } from "../tenancy/provisioning";
import { PlatformAuditWriter } from "./platform-audit.writer";
import { CustomDomainsService } from "./custom-domains.service";

export class TenantAccessError extends Error {
  readonly status = 403;
  constructor(message = 'Not allowed to manage this tenant') {
    super(message);
  }
}

/** Fields a tenant administrator may change on their own tenant. Staff may additionally change `status`. */
const TENANT_EDITABLE_FIELDS = [
  'name', 'logoUrl', 'pallette', 'allowedDomains', 'addressLine1', 'addressLine2', 'city', 'country', 'state', 'zipCode',
  'startWorkingHour', 'endWorkingHour',
] as const;

/** Tenant directory operations. Creating, listing and deleting tenants is reserved to platform staff. */
@Injectable({
  scope: Scope.REQUEST
})
export class TenantsService extends AbstractService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(DomainsService) private readonly domainsService: DomainsService,
    @Inject(InvitationsService) private readonly invitationsService: InvitationsService,
    @Inject(PlatformAuditWriter) private readonly platformAudit: PlatformAuditWriter,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
  ) { super(); }

  private get staffActor() {
    return { type: 'staff', id: this.auth.user?.userId, email: this.auth.user?.email };
  }

  private get isStaff() {
    return this.auth.claims?.kind === 'staff';
  }

  private assertStaff(permission = 'platform.tenants:read') {
    if (!this.isStaff || !this.auth.user?.permissions.includes(permission)) throw new TenantAccessError('Only platform staff can do this');
  }

  /** The tenant of the caller, or (for staff/anonymous callers) the one named by the request. */
  async getContextualTenant(): Promise<Tenant | null> {
    return this.auth.tenant ?? this.directory.findByKey(this.auth.requestedTenant);
  }

  /**
   * Onboard a financial institution: tenant record + default roles, invitations for the listed people (the first
   * `admin` invitee administers the tenant) and the DNS records its custom domains need.
   */
  async create(data: CreateTenant): Promise<Tenant & { cnameRecords: CNAMERecordResponse[]; invitations: string[] }> {
    this.assertStaff('platform.tenants:create');
    const tenant = await provisionTenant(this.databases, data);

    const invitations: string[] = [];
    for (const { email, role } of data.invitee ?? []) {
      try {
        await this.invitationsService.createInvitation(email, role || 'admin', tenant.domain);
        invitations.push(email);
      } catch (error) {
        console.error('Failed to create invitation', { email, error });
      }
    }

    await this.platformAudit.record(this.staffActor, 'tenant.created', { type: 'tenant', id: tenant.id, name: tenant.name }, tenant, { invitations });

    const cnameRecords = tenant.allowedDomains.length
      ? await this.domainsService.setupTenantDomains({ tenantDomains: tenant.allowedDomains })
      : [];

    return { ...tenant, cnameRecords, invitations };
  }

  async getByDomain(domain: string) {
    const tenant = await this.directory.findByKey(domain);
    if (!tenant) return null;
    // Members and clients only ever see their own tenant.
    if (!this.isStaff && this.auth.tenant?.id !== tenant.id) return null;
    return tenant;
  }

  async getAllTenants() {
    this.assertStaff();
    return this.databases.platform.select().from(tenants).orderBy(asc(tenants.name));
  }

  async update(domain: string, data: Partial<Tenant>) {
    const tenant = await this.directory.findByKey(domain);
    if (!tenant) throw new TenantProvisioningError('Tenant not found', 400);

    const changes: Partial<Tenant> = {};
    for (const field of TENANT_EDITABLE_FIELDS) {
      if (data[field] !== undefined) (changes as any)[field] = data[field];
    }

    if (this.isStaff && data.status) changes.status = data.status;
    if (changes.allowedDomains) {
      changes.allowedDomains = [...new Set(changes.allowedDomains.map((h) => String(h).trim().toLowerCase()).filter(Boolean))];
      // A host serves one institution only (no takeover of another institution's host).
      const conflicts = await CustomDomainsService.conflicts(this.databases, tenant.id, changes.allowedDomains);
      if (conflicts.length) throw new TenantProvisioningError(`Already used by another institution: ${conflicts.join(', ')}`, 409);
      // Institutions add hosts through verified custom domains (POST /domains); only staff set them directly.
      const added = changes.allowedDomains.filter((h) => !tenant.allowedDomains.includes(h));
      if (added.length && !this.isStaff) throw new TenantProvisioningError(`Add ${added.join(', ')} under Domains and verify it first`, 403);
    }
    // Nothing the caller may change (e.g. a member sending only `status`): no-op rather than an invalid UPDATE.
    const noChanges = Object.keys(changes).length === 0;

    if (this.isStaff) {
      this.assertStaff('platform.tenants:update');
      if (noChanges) return tenant;
      const [updated] = await this.databases.platform.update(tenants).set(changes).where(eq(tenants.id, tenant.id)).returning();
      const action = changes.status && changes.status !== tenant.status
        ? (changes.status === 'suspended' ? 'tenant.suspended' : 'tenant.reactivated')
        : 'tenant.updated';
      await this.platformAudit.record(this.staffActor, action, { type: 'tenant', id: tenant.id, name: tenant.name }, tenant, { fields: Object.keys(changes) });
      return updated;
    }

    if (this.auth.tenant?.id !== tenant.id || !this.auth.user?.permissions.includes('workspace:update')) {
      throw new TenantAccessError();
    }
    if (noChanges) return tenant;
    // Through the tenant-scoped connection: row level security only lets a tenant update its own row.
    const [updated] = await this.databases.forTenant(tenant.id).update(tenants).set(changes).where(eq(tenants.id, tenant.id)).returning();
    return updated;
  }

  async delete(domain: string) {
    this.assertStaff('platform.tenants:delete');
    const tenant = await this.directory.findByKey(domain);
    if (!tenant) throw new TenantProvisioningError('Tenant not found', 400);
    // Two-step offboarding: an institution must be suspended (everyone signed out) before its data is deleted.
    if (tenant.status === 'active') throw new TenantProvisioningError('Suspend the institution before deleting it', 409);
    // Running cases are stopped first, then tenant data is removed by ON DELETE CASCADE on every tenant_id foreign key.
    const caseIds = (await this.databases.forTenant(tenant.id).select({ id: cases.id }).from(cases).where(notInArray(cases.status, FINAL_CASE_STATUSES))).map((c) => c.id);
    if (caseIds.length) {
      await this.engine.killCases(caseIds).catch((error) => console.warn(`Could not stop the cases of ${tenant.domain}: ${error.message}`));
    }
    await this.databases.platform.delete(tenants).where(eq(tenants.id, tenant.id));
    await this.platformAudit.record(this.staffActor, 'tenant.deleted', { type: 'tenant', id: tenant.id, name: tenant.name }, tenant);
  }
}
