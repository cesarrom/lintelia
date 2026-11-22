import { backOfficePageSources, widgetsSources, type BackOfficeDefinition, type BackOfficeWidget } from '@repo/lintelia/schemas';
import { bankingRecords } from '@/client-app/sample-data';
import type { AppData } from '@/client-app/types';

/**
 * Sample data for the back-office studio's canvas (no one's real data): a member, a few cases of the workflows the
 * actions run (and of a generic one), tasks, counts, a client and a case for pages about them, and records of any
 * collection the widgets read (banking data for the banking collections, generated otherwise).
 */
const DAY = 86_400_000;
const NAMES = ['Chris Client', 'Ada Lovelace', 'Sam Patel', 'Noor Haddad', 'Lena Fischer', 'Tom Okafor'];
const STATUSES = ['in_review', 'completed', 'completed', 'in_progress', 'pending_client', 'rejected'];
const OUTCOMES: Record<string, string | null> = { in_review: null, completed: 'approved', in_progress: null, pending_client: null, rejected: 'declined' };

export function sampleBackOfficeData(definition: BackOfficeDefinition, workflows: Array<{ id: string; name: string }>, widgets: BackOfficeWidget[], member: { email: string; name: string | null }): AppData {
  const now = Date.now();
  const actionWorkflows = [...new Set(Object.values(definition.actions).map((a) => workflows.find((w) => w.id === a.workflowId)?.name).filter(Boolean) as string[])];
  const names = actionWorkflows.length ? [...actionWorkflows, 'Account opening'] : ['Account opening', 'Personal loan'];
  const cases = NAMES.map((applicant, i) => {
    const status = STATUSES[i % STATUSES.length];
    const workflowName = names[i % names.length];
    return {
      id: `sample-case-${i + 1}`, reference: `C-2026-SAMP${i + 1}`, title: `${workflowName}: ${applicant}`, status,
      outcome: status === 'completed' && /fee/i.test(workflowName) ? 'fee_waived' : OUTCOMES[status], stage: status === 'in_review' ? 'Review' : null,
      riskLevel: i % 3 === 0 ? 'low' : 'medium', flags: [], workflow: { id: `sample-wf-${i % names.length}`, version: 1, name: workflowName }, workflowName,
      applicant: { id: `sample-client-${i + 1}`, email: `${applicant.split(' ')[0].toLowerCase()}@example.com`, name: applicant },
      initiatedBy: { type: 'member', id: 'sample-member', email: member.email }, source: 'backoffice', createdAt: new Date(now - (i + 1) * 0.8 * DAY).toISOString(),
      updatedAt: new Date(now - i * 0.5 * DAY).toISOString(),
    };
  });
  const tasks = cases.filter((c) => c.status === 'in_review').map((c, i) => ({
    id: `sample-task-${i + 1}`, caseId: c.id, caseReference: c.reference, title: `Review: ${c.title}`, kind: 'review', status: 'open', queueRole: 'reviewer',
    dueAt: new Date(now + (i ? 2 : -1) * DAY).toISOString(), createdAt: c.createdAt, view: i ? 'queue' : 'mine',
  }));
  const count = (by: (c: (typeof cases)[number]) => string | null) => cases.reduce<Record<string, number>>((acc, c) => { const k = by(c) ?? 'none'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const open = cases.filter((c) => !['completed', 'rejected'].includes(c.status));
  const client = { id: 'sample-client-1', email: 'chris@example.com', name: 'Chris Client', firstName: 'Chris', lastName: 'Client', externalId: 'C-0001', status: 'active', segments: ['customer'], createdAt: new Date(now - 400 * DAY).toISOString() };
  const sources = new Set([...widgetsSources(widgets), ...Object.values(definition.pages).flatMap((p) => backOfficePageSources(p))]);
  const records: Record<string, unknown[]> = {};
  for (const source of sources) {
    if (!source.startsWith('records:')) continue;
    const collection = source.slice('records:'.length);
    records[collection] = (bankingRecords(collection, client.name) ?? [1, 2, 3].map((i) => ({ key: `${collection}-${i}`, name: `${collection} ${i}`, status: 'active', amount: 125.5 * i, date: new Date(now - i * DAY).toISOString() })))
      .map((r) => ({ ...r, clientId: client.id, clientName: client.name, clientEmail: client.email }));
  }
  return {
    member: { id: 'sample-member', email: member.email, name: member.name ?? 'Sample member', roles: [], attributes: {} },
    cases, tasks,
    metrics: {
      tasks: { mine: tasks.filter((t) => t.view === 'mine').length, queue: tasks.filter((t) => t.view === 'queue').length, overdue: 1 },
      cases: { open: open.length, total: cases.length, byStatus: count((c) => c.status), byWorkflow: count((c) => c.workflowName), byStage: count((c) => c.stage) },
    },
    client, case: cases[0], records,
  } as unknown as AppData;
}
