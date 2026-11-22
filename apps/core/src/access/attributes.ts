import { Inject, Injectable, Scope } from '@nestjs/common';
import jsonata from 'jsonata';
import { asc, eq } from 'drizzle-orm';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { memberAttributeDefinitions, users } from '../entities';
import type { Databases, TenantDatabase } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import { USER } from '../injector/tokens/user.token';
import { AuditWriter } from '../services/audit.writer';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';
import { conditionError } from './rules';

/**
 * Member attributes (docs/plans/15 §5.5): the institution declares them (branch, region, licences, authority limit)
 * and says where their values come from — set by hand in the Team page, or read from the identity provider (a claim of
 * the SSO sign-in, an attribute of the SCIM directory; JSONata over what the IdP sent). IdP values are read-only in the
 * app. Access conditions (`when`) read them as `member.attributes.<key>`.
 */
export const ATTRIBUTE_TYPES = ['text', 'number', 'select', 'list'] as const;
type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
type DefinitionRow = typeof memberAttributeDefinitions.$inferSelect;

export interface AttributeDefinition {
  key: string;
  label: string;
  type: AttributeType;
  options: string[];
  source: 'manual' | 'idp';
  ssoClaim: string | null;
  scimAttribute: string | null;
}

const KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,47}$/;

export const presentDefinition = (row: DefinitionRow): AttributeDefinition => ({
  key: row.key, label: row.label, type: row.type as AttributeType, options: row.options, source: row.source as 'manual' | 'idp',
  ssoClaim: row.ssoClaim, scimAttribute: row.scimAttribute,
});

/** A value as its declared type (null when it cannot be one). */
export function coerce(definition: Pick<AttributeDefinition, 'type' | 'options'>, value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  switch (definition.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value).trim());
      return Number.isFinite(n) ? n : null;
    }
    case 'list': {
      const items = (Array.isArray(value) ? value : String(value).split(',')).map((v) => String(v).trim()).filter(Boolean);
      return [...new Set(items)];
    }
    case 'select': {
      const text = String(Array.isArray(value) ? value[0] ?? '' : value).trim();
      return !definition.options.length || definition.options.includes(text) ? text : null;
    }
    default:
      return String(Array.isArray(value) ? value.join(', ') : value).trim().slice(0, 500) || null;
  }
}

export async function attributeDefinitions(db: TenantDatabase) {
  return (await db.select().from(memberAttributeDefinitions).orderBy(asc(memberAttributeDefinitions.label))).map(presentDefinition);
}

/** Reads IdP attributes into members (SSO sign-ins and directory events). */
@Injectable()
export class MemberAttributeSync {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  async apply(tenant: Tenant, userId: string, source: 'sso' | 'scim', raw: Record<string, unknown>) {
    const db = this.databases.forTenant(tenant.id);
    const definitions = (await attributeDefinitions(db)).filter((d) => d.source === 'idp' && (source === 'sso' ? d.ssoClaim : d.scimAttribute));
    if (!definitions.length) return;
    const [user] = await db.select({ attributes: users.attributes, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;
    const next = { ...(user.attributes ?? {}) };
    for (const definition of definitions) {
      const expression = (source === 'sso' ? definition.ssoClaim : definition.scimAttribute)!;
      let value: unknown = null;
      try {
        value = await jsonata(expression).evaluate(raw ?? {});
      } catch {
        value = null;
      }
      const coerced = coerce(definition, value);
      if (coerced === null) delete next[definition.key];
      else next[definition.key] = coerced;
    }
    if (JSON.stringify(next) === JSON.stringify(user.attributes ?? {})) return;
    await db.update(users).set({ attributes: next }).where(eq(users.id, userId));
    await this.audit.record(tenant.id, { type: 'system', email: 'identity-provider' }, 'member.attributes_synced', { type: 'user', id: userId, email: user.email }, { source, before: user.attributes ?? {}, after: next });
  }
}

/** Declaring attributes and setting the manual ones (Team page). */
@Injectable({ scope: Scope.REQUEST })
export class MemberAttributesService {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: TenantDatabase,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  list() {
    return attributeDefinitions(this.db);
  }

  /** Replace the declarations (values of removed attributes stay on members until overwritten, but nothing reads them). */
  async save(input: unknown) {
    if (!Array.isArray(input)) throw new BadRequestError('Send the list of attributes');
    const seen = new Set<string>();
    const clean: Array<typeof memberAttributeDefinitions.$inferInsert> = [];
    for (const raw of input as Array<Record<string, unknown>>) {
      const key = String(raw?.key ?? '').trim();
      if (!KEY.test(key)) throw new BadRequestError(`"${key}": attribute keys are letters, digits and _ (starting with a letter)`);
      if (seen.has(key)) throw new BadRequestError(`"${key}" is declared twice`);
      seen.add(key);
      const type = String(raw?.type ?? 'text') as AttributeType;
      if (!ATTRIBUTE_TYPES.includes(type)) throw new BadRequestError(`"${key}": type must be ${ATTRIBUTE_TYPES.join(', ')}`);
      const options = Array.isArray(raw?.options) ? [...new Set((raw.options as unknown[]).map((o) => String(o).trim()).filter(Boolean))] : [];
      if (type === 'select' && !options.length) throw new BadRequestError(`"${key}": a choice needs options`);
      const source = raw?.source === 'idp' ? 'idp' : 'manual';
      const ssoClaim = typeof raw?.ssoClaim === 'string' && raw.ssoClaim.trim() ? raw.ssoClaim.trim() : null;
      const scimAttribute = typeof raw?.scimAttribute === 'string' && raw.scimAttribute.trim() ? raw.scimAttribute.trim() : null;
      if (source === 'idp' && !ssoClaim && !scimAttribute) throw new BadRequestError(`"${key}": say which SSO claim or directory attribute gives it`);
      for (const [what, expression] of [['SSO claim', ssoClaim], ['directory attribute', scimAttribute]] as const) {
        const error = conditionError(expression ?? undefined);
        if (error) throw new BadRequestError(`"${key}": the ${what} is not valid JSONata (${error})`);
      }
      clean.push({ key, label: String(raw?.label ?? key).trim().slice(0, 255) || key, type, options, source, ssoClaim: source === 'idp' ? ssoClaim : null, scimAttribute: source === 'idp' ? scimAttribute : null });
    }
    const before = await this.list();
    await this.db.transaction(async (tx) => {
      await tx.delete(memberAttributeDefinitions);
      if (clean.length) await tx.insert(memberAttributeDefinitions).values(clean);
    });
    await this.audit.record(this.tenant.id, this.actor, 'member_attributes.declared', { type: 'tenant', id: this.tenant.id }, { before: before.map((d) => d.key), after: clean.map((d) => d.key) });
    return this.list();
  }

  /** Set manual attributes of a member (IdP ones are read-only: change them in the identity provider). */
  async setValues(userId: string, values: unknown) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new BadRequestError('Send { key: value }');
    const [member] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!member || member.kind !== 'member') throw new NotFoundError('Member not found');
    const definitions = await this.list();
    const next = { ...(member.attributes ?? {}) };
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      const definition = definitions.find((d) => d.key === key);
      if (!definition) throw new BadRequestError(`Unknown attribute ${key}`);
      if (definition.source === 'idp') throw new ConflictError(`${definition.label} comes from your identity provider`);
      const coerced = coerce(definition, value);
      if (coerced === null && value !== null && value !== '') throw new BadRequestError(`${definition.label}: not a valid ${definition.type}`);
      if (coerced === null) delete next[key];
      else next[key] = coerced;
    }
    await this.db.update(users).set({ attributes: next }).where(eq(users.id, userId));
    await this.audit.record(this.tenant.id, this.actor, 'member.attributes_changed', { type: 'user', id: userId, email: member.email }, { before: member.attributes ?? {}, after: next });
    return next;
  }
}
