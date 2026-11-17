import { and, desc, eq, ne, sql } from 'drizzle-orm';
import jsonata from 'jsonata';
import { appSources, clientAppDefinitionSchema, isRecordSource, ordered, recordCollectionOf, type ClientAppDefinition } from '@repo/fintivio/schemas';
import { cases, clientApps, clientAppVersions, clientNotifications, tasks } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { isFinalStatus } from '../engine/case-repository';
import { listNotifications, listRecords, loadMe, type MeView } from './profiles';
import type { ScreenDefinition } from '../engine/components/client-app';
import { clientActionView } from '../services/tasks.service';

/**
 * What a client's app reads (docs/plans/11 §2.3): resolved on the server, under the client's identity, limited to
 * the sources the published app declares. Shared by the client runtime and the studio's preview.
 */

export async function loadApp(db: TenantDatabase) {
  const [app] = await db.select().from(clientApps).where(eq(clientApps.key, 'default')).limit(1);
  return app ?? null;
}

/** The published definition clients get (null when the institution has not published an app). */
export async function loadActiveDefinition(db: TenantDatabase): Promise<{ version: number; definition: ClientAppDefinition; appId: string } | null> {
  const app = await loadApp(db);
  if (!app?.activeVersion) return null;
  const [row] = await db.select().from(clientAppVersions).where(and(eq(clientAppVersions.appId, app.id), eq(clientAppVersions.version, app.activeVersion))).limit(1);
  if (!row) return null;
  return { version: row.version, definition: clientAppDefinitionSchema.parse(row.definition), appId: app.id };
}

export async function evaluateRule(expression: string | undefined, input: unknown, fallback = true): Promise<boolean> {
  if (!expression?.trim()) return fallback;
  try {
    return Boolean(await jsonata(expression.trim().replace(/^=/, '')).evaluate(input));
  } catch {
    return false;
  }
}

const CLIENT_STATUS: Record<string, string> = {
  submitted: 'Received', in_progress: 'In progress', in_review: 'Under review', pending_client: 'Waiting for you',
  approved: 'Approved', rejected: 'Not approved', closed: 'Closed', completed: 'Completed', withdrawn: 'Cancelled', expired: 'Expired', failed: 'Something went wrong',
};
export const clientStatusLabel = (status: string) => CLIENT_STATUS[status] ?? status.replace(/_/g, ' ');

const PROGRESS: Record<string, number> = { submitted: 15, in_progress: 45, pending_client: 50, in_review: 75 };
const journeyKeyOf = (source: string) => (source.startsWith('client:') ? source.slice('client:'.length) : null);

type TaskRow = typeof tasks.$inferSelect;

const openClientTasks = (rows: TaskRow[], clientId: string) => rows.filter((t) => t.audience === 'client' && t.status === 'open' && t.assigneeId === clientId);

/** Stages of a journey with their state: done / current / todo. */
function stagesOf(definition: ClientAppDefinition | null, journeyKey: string | null, current: string | null, final: boolean) {
  const stages = (journeyKey && definition?.journeys[journeyKey]?.stages) || [];
  const index = final ? stages.length : Math.max(0, stages.findIndex((s) => s.key === current));
  return stages.map((stage, i) => ({ ...stage, status: i < index ? 'done' : i === index && !final ? 'current' : final ? 'done' : 'todo' }));
}

/** `cases`: my applications and journeys (never investigations), with the stage they are at. */
export async function myCasesView(db: TenantDatabase, clientId: string, definition: ClientAppDefinition | null) {
  const rows = await db.select().from(cases)
    .where(and(eq(cases.applicantId, clientId), ne(cases.status, 'draft'), eq(cases.clientVisibility, 'full')))
    .orderBy(desc(cases.createdAt)).limit(100);
  if (!rows.length) return [];
  const taskRows = await db.select().from(tasks).where(and(eq(tasks.assigneeId, clientId), eq(tasks.status, 'open')));
  return rows.map((kase) => {
    const journeyKey = journeyKeyOf(kase.source);
    const journey = journeyKey ? definition?.journeys[journeyKey] : undefined;
    const waiting = taskRows.some((t) => t.caseId === kase.id && t.audience === 'client');
    const screen = taskRows.find((t) => t.caseId === kase.id && t.kind === 'screen');
    const final = isFinalStatus(kase.status);
    const stageKey = (screen?.screen as ScreenDefinition | null)?.stage ?? kase.stage ?? (kase.status === 'in_review' || kase.status === 'in_progress' ? 'review' : null);
    const stage = journey?.stages.find((s) => s.key === stageKey)?.label ?? null;
    return {
      id: kase.id, reference: kase.reference, title: journey?.title ?? kase.title, status: kase.status, statusLabel: clientStatusLabel(kase.status),
      journey: journeyKey, icon: journey?.icon ?? null, stage, waitingForMe: waiting, final,
      progress: final ? 100 : PROGRESS[kase.status] ?? 30,
      createdAt: kase.createdAt.toISOString(), updatedAt: kase.updatedAt.toISOString(),
    };
  });
}

/** `requests`: what the institution waits for from me (journey screens left half way included). */
export async function myRequestsView(db: TenantDatabase, clientId: string, definition: ClientAppDefinition | null) {
  const rows = await db.select({ task: tasks, kase: cases }).from(tasks)
    .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
    .where(and(eq(tasks.audience, 'client'), eq(tasks.assigneeId, clientId)))
    .orderBy(sql`${tasks.createdAt} desc`).limit(100);
  return rows.map(({ task, kase }) => {
    const journeyKey = journeyKeyOf(kase.source);
    return {
      id: task.id, kind: task.kind, title: task.title, description: task.description, status: task.status, dueAt: task.dueAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      // Investigations (`requests_only`) never show the case.
      case: kase.clientVisibility === 'full' ? { id: kase.id, reference: kase.reference, title: (journeyKey && definition?.journeys[journeyKey]?.title) || kase.title } : null,
      journey: kase.clientVisibility === 'full' ? journeyKey : null,
    };
  });
}

/** `journeys`: what I may start now (eligibility applied), hidden journeys excluded. */
export async function journeysView(me: MeView, definition: ClientAppDefinition) {
  const list = [];
  for (const [key, journey] of ordered(definition.journeys, definition.journeyOrder)) {
    if (journey.hidden) continue;
    if (!(await evaluateRule(journey.eligibility, me))) continue;
    list.push({ key, title: journey.title, description: journey.description ?? null, icon: journey.icon ?? null, category: journey.category ?? null });
  }
  return list;
}

/** Resolve the requested sources; anything the app does not declare is refused. */
export async function resolveSources(db: TenantDatabase, clientId: string, definition: ClientAppDefinition, requested: string[]) {
  const allowed = new Set(appSources(definition));
  const refused = requested.filter((s) => !allowed.has(s));
  if (refused.length) return { error: `Not available in this app: ${refused.join(', ')}` as const };
  const me = await loadMe(db, clientId);
  if (!me) return { error: 'Not a client' as const };
  const data: Record<string, unknown> = { me };
  const records: Record<string, unknown[]> = {};
  for (const source of new Set(requested)) {
    if (source === 'me') continue;
    if (isRecordSource(source)) records[recordCollectionOf(source)] = await listRecords(db, clientId, recordCollectionOf(source));
    else if (source === 'cases') data.cases = await myCasesView(db, clientId, definition);
    else if (source === 'requests') data.requests = await myRequestsView(db, clientId, definition);
    else if (source === 'notifications') data.notifications = await listNotifications(db, clientId);
    else if (source === 'journeys') data.journeys = await journeysView(me, definition);
  }
  data.records = records;
  return { data };
}

/** Where a journey stands for the client: a screen to fill, a request to answer, waiting on the team, or done. */
export async function journeyState(db: TenantDatabase, clientId: string, caseId: string, definition: ClientAppDefinition | null) {
  const [kase] = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.applicantId, clientId), eq(cases.clientVisibility, 'full'))).limit(1);
  if (!kase) return null;
  const rows = await db.select().from(tasks).where(eq(tasks.caseId, caseId));
  const open = openClientTasks(rows, clientId);
  const screenTask = open.find((t) => t.kind === 'screen');
  const requests = open.filter((t) => t.kind !== 'screen' && t.kind !== 'confirmation');
  const memberOpen = rows.some((t) => t.audience === 'member' && !['completed', 'cancelled', 'expired'].includes(t.status));
  const final = isFinalStatus(kase.status);
  const state = screenTask ? 'screen' : requests.length ? 'request' : final ? 'done' : memberOpen ? 'waiting' : 'working';
  const journeyKey = journeyKeyOf(kase.source);
  const journey = journeyKey ? definition?.journeys[journeyKey] : undefined;
  const screen = screenTask?.screen as ScreenDefinition | null | undefined;
  // The workflow's business stage (case.update) when the journey declares it, else where the client is.
  const declared = (journeyKey && definition?.journeys[journeyKey]?.stages) || [];
  const currentStage = screen?.stage ?? (kase.stage && declared.some((s) => s.key === kase.stage) ? kase.stage : null) ?? (state === 'waiting' ? 'review' : state === 'working' ? 'decision' : null);
  // The journey's last message to the client (client.notify), shown when it ends.
  const [message] = state === 'done' ? await db.select().from(clientNotifications)
    .where(and(eq(clientNotifications.clientId, clientId), sql`${clientNotifications.link}->>'caseId' = ${caseId}`))
    .orderBy(desc(clientNotifications.createdAt)).limit(1) : [];
  return {
    case: { id: kase.id, reference: kase.reference, title: journey?.title ?? kase.title, status: kase.status, statusLabel: clientStatusLabel(kase.status), outcome: kase.outcome, stage: kase.stage },
    journey: journeyKey ? { key: journeyKey, title: journey?.title ?? kase.title, donePage: journey?.donePage ?? null, icon: journey?.icon ?? null } : null,
    state,
    stages: stagesOf(definition, journeyKey, currentStage, final),
    screen: screenTask && screen ? { taskId: screenTask.id, ...screen } : null,
    message: message ? { title: message.title, body: message.body, tone: message.tone } : null,
    requests: requests.map((t) => ({
      id: t.id, kind: t.kind, title: t.title, description: t.description, status: t.status, items: t.requestItems ?? [], dueAt: t.dueAt, answeredAt: null,
      action: t.clientAction ? clientActionView(t.clientAction) : null,
    })),
  };
}
