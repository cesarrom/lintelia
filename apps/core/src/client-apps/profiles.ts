import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { clientNotifications, clientProfiles, clientRecords, users } from '../entities';
import type { TenantDatabase } from '../clients/database.client';

/**
 * Client profiles, records and notifications (docs/plans/11): helpers shared by the request-scoped services and the
 * workflow components (which run in the engine, outside Nest). Always called on a tenant-scoped database.
 */
export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof clientProfiles.$inferSelect;
export type RecordRow = typeof clientRecords.$inferSelect;

/** The profile of a client, created empty on first use. */
export async function ensureProfile(db: TenantDatabase, userId: string): Promise<ProfileRow> {
  await db.insert(clientProfiles).values({ userId }).onConflictDoNothing({ target: [clientProfiles.tenantId, clientProfiles.userId] });
  const [row] = await db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1);
  return row;
}

export interface MeView {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  externalId: string | null;
  segments: string[];
  attributes: Record<string, unknown>;
  consents: Array<{ key: string; version: string; acceptedAt: string }>;
  since: string;
  [attribute: string]: unknown;
}

/** What screens and workflows see as `me`: identity, attributes (also flattened), segments, consents. */
export function meView(user: UserRow, profile: ProfileRow): MeView {
  const name = user.name && user.name !== user.email ? user.name : '';
  const [first, ...rest] = name.split(' ');
  return {
    ...profile.attributes,
    id: user.id,
    email: user.email,
    name: name || user.email,
    firstName: user.givenName || first || user.email.split('@')[0],
    lastName: user.familyName || rest.join(' '),
    externalId: profile.externalId,
    segments: profile.segments,
    attributes: profile.attributes,
    consents: profile.consents,
    since: user.createdAt.toISOString(),
  };
}

export async function loadMe(db: TenantDatabase, userId: string): Promise<MeView | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.kind !== 'client') return null;
  return meView(user, await ensureProfile(db, userId));
}

/**
 * Change a profile atomically (workflows, the institution's systems and the client may write at the same time):
 * attributes are merged, segments added / removed / replaced in SQL, not read-modified-written.
 */
export async function updateProfile(db: TenantDatabase, userId: string, changes: { attributes?: Record<string, unknown>; addSegments?: string[]; removeSegments?: string[]; segments?: string[]; externalSource?: string; externalId?: string }) {
  const profile = await ensureProfile(db, userId);
  let segments = changes.segments ? sql`${toTextArray(changes.segments)}` : sql`${clientProfiles.segments}`;
  if (changes.addSegments?.length) segments = sql`array(select distinct s from unnest(${segments} || ${toTextArray(changes.addSegments)}) as s order by s)`;
  if (changes.removeSegments?.length) segments = sql`array(select s from unnest(${segments}) as s where s <> all(${toTextArray(changes.removeSegments)}))`;
  const [row] = await db.update(clientProfiles).set({
    attributes: sql`${clientProfiles.attributes} || ${JSON.stringify(changes.attributes ?? {})}::jsonb`,
    segments: sql`${segments}` as unknown as string[],
    ...(changes.externalId ? { externalId: changes.externalId, externalSource: changes.externalSource ?? 'api' } : {}),
  }).where(eq(clientProfiles.id, profile.id)).returning();
  return row;
}

const toTextArray = (values: string[]) => sql`array[${sql.join(values.map((v) => sql`${v}`), sql`, `)}]::text[]`;

export const recordView = (row: RecordRow): Record<string, unknown> & { key: string; updatedAt: string } => ({ ...row.data, key: row.key, updatedAt: row.updatedAt.toISOString() });

export async function listRecords(db: TenantDatabase, clientId: string, collection: string, limit = 1000) {
  const rows = await db.select().from(clientRecords)
    .where(and(eq(clientRecords.clientId, clientId), eq(clientRecords.collection, collection)))
    .orderBy(desc(clientRecords.updatedAt), asc(clientRecords.key)).limit(limit);
  return rows.map(recordView);
}

/** Create or replace (`upsert`), or add to (`merge`) the data of one record. */
/** Create or replace a record (`upsert`), or change some of its fields (`merge`, atomic in SQL). */
export async function writeRecord(db: TenantDatabase, input: { clientId: string; collection: string; key: string; data: Record<string, unknown>; source: string; mode?: 'upsert' | 'merge' }) {
  const data = input.mode === 'merge' ? sql`${clientRecords.data} || ${JSON.stringify(input.data)}::jsonb` : input.data;
  const [row] = await db.insert(clientRecords).values({ clientId: input.clientId, collection: input.collection, key: input.key, data: input.data, source: input.source })
    .onConflictDoUpdate({
      target: [clientRecords.tenantId, clientRecords.clientId, clientRecords.collection, clientRecords.key],
      set: { data: data as Record<string, unknown>, source: input.source, updatedAt: new Date() },
    }).returning();
  return recordView(row);
}

export async function deleteRecord(db: TenantDatabase, clientId: string, collection: string, key: string) {
  const rows = await db.delete(clientRecords).where(and(eq(clientRecords.clientId, clientId), eq(clientRecords.collection, collection), eq(clientRecords.key, key))).returning();
  return rows.length > 0;
}

export async function notify(db: TenantDatabase, input: { clientId: string; title: string; body?: string | null; tone?: string; link?: { page?: string; params?: Record<string, string>; caseId?: string } | null }) {
  const [row] = await db.insert(clientNotifications).values({
    clientId: input.clientId, title: input.title.slice(0, 255), body: input.body ?? null, tone: input.tone ?? 'info', link: input.link ?? null,
  }).returning();
  return row;
}

export async function listNotifications(db: TenantDatabase, clientId: string, limit = 50) {
  const rows = await db.select().from(clientNotifications).where(eq(clientNotifications.clientId, clientId)).orderBy(desc(clientNotifications.createdAt)).limit(limit);
  return rows.map((n) => ({ id: n.id, title: n.title, body: n.body, tone: n.tone, link: n.link, read: !!n.readAt, createdAt: n.createdAt.toISOString() }));
}

export async function markNotificationsRead(db: TenantDatabase, clientId: string, id?: string) {
  await db.update(clientNotifications).set({ readAt: new Date() })
    .where(and(eq(clientNotifications.clientId, clientId), id ? eq(clientNotifications.id, id) : sql`${clientNotifications.readAt} is null`));
}
