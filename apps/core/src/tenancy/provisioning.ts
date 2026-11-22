import { eq } from 'drizzle-orm';
import { SYSTEM_ROLES, type Tenant } from '@repo/lintelia/schemas';
import { roles, tenants } from '../entities';
import type { Databases } from '../clients/database.client';

export interface ProvisionTenantInput {
  name: string;
  domain: string;
  allowedDomains?: string[];
  logoUrl?: string;
  pallette?: { primary: string; secondary: string; accent: string };
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  state?: string;
  zipCode?: string;
  startWorkingHour?: string;
  endWorkingHour?: string;
}

/** Every tenant gets the system roles of the authorization catalogue (their permissions come from code). */
export const systemRoleRows = () => SYSTEM_ROLES.map((role) => ({
  key: role.key, name: role.name, description: role.description, permissions: [] as string[], isSystem: true,
}));

/** Add system roles a tenant does not have yet (new roles in a release) and refresh names/descriptions. */
export async function syncSystemRoles(databases: Databases, tenantId: string) {
  const db = databases.forTenant(tenantId);
  for (const row of systemRoleRows()) {
    await db.insert(roles).values(row).onConflictDoUpdate({
      target: [roles.tenantId, roles.key],
      set: { name: row.name, description: row.description, isSystem: true },
    });
  }
}

const TENANT_KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/;

export class TenantProvisioningError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 409 = 400) {
    super(message);
    this.name = 'TenantProvisioningError';
  }
}

export const normalizeTenantKey = (value: string) => value.trim().toLowerCase();

/**
 * Create a tenant: the directory row (platform connection) and its default roles (tenant-scoped connection, i.e.
 * through row level security as the new tenant). The directory row is removed again if seeding the tenant fails.
 */
export async function provisionTenant(databases: Databases, input: ProvisionTenantInput): Promise<Tenant> {
  const domain = normalizeTenantKey(input.domain ?? '');
  if (!TENANT_KEY_RE.test(domain)) {
    throw new TenantProvisioningError('Tenant key must be lowercase letters, digits and dashes (max 63 characters)');
  }
  if (!input.name?.trim()) {
    throw new TenantProvisioningError('Tenant name is required');
  }
  const allowedDomains = [...new Set((input.allowedDomains ?? []).map(normalizeTenantKey).filter(Boolean))];
  const invalidHost = allowedDomains.find((host) => !HOST_RE.test(host));
  if (invalidHost) {
    throw new TenantProvisioningError(`Invalid host name: ${invalidHost}`);
  }

  const [existing] = await databases.platform.select({ id: tenants.id }).from(tenants).where(eq(tenants.domain, domain)).limit(1);
  if (existing) {
    throw new TenantProvisioningError('Tenant already exists', 409);
  }

  const [tenant] = await databases.platform.insert(tenants).values({
    name: input.name.trim(),
    domain,
    allowedDomains,
    logoUrl: input.logoUrl ?? '',
    pallette: input.pallette ?? { primary: '#0f172a', secondary: '#334155', accent: '#2563eb' },
    addressLine1: input.addressLine1 ?? '',
    addressLine2: input.addressLine2 ?? '',
    city: input.city ?? '',
    country: input.country ?? '',
    state: input.state ?? '',
    zipCode: input.zipCode ?? '',
    startWorkingHour: input.startWorkingHour ?? '09:00',
    endWorkingHour: input.endWorkingHour ?? '17:00',
  }).returning();

  try {
    await databases.forTenant(tenant.id).insert(roles).values(systemRoleRows());
  } catch (error) {
    await databases.platform.delete(tenants).where(eq(tenants.id, tenant.id));
    throw error;
  }

  return tenant;
}
