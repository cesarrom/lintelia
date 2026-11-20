import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { backOfficeDefinitionSchema, type BackOfficeDefinition } from '@repo/lintelia/schemas';
import { customPermissions, memberAttributeDefinitions, sysWorkflows } from '../../entities';
import type { TenantDatabase } from '../../clients/database.client';
import { parseDefinition } from '../../engine/definition';

/**
 * Ready-made back offices (docs/plans/16 §11, decision 5). "Fee waivers" is the reference: every piece of the back office
 * used for one real need — a custom permission (*Waive fees*), an attribute of members (*authority limit*), a workflow
 * gated to the permission with a staff screen and an approval above the member's authority, a page in the menu, a
 * button and a tab on the built-in client page, a widget on the dashboard. The client sees the refund in their app.
 */
export const BACK_OFFICE_TEMPLATES = [
  {
    id: 'fee-waivers', name: 'Fee waivers (servicing desk)', category: 'Servicing',
    description: 'Relationship managers waive a fee from the client page; above their authority limit a senior reviewer approves; the refund appears in the client\'s app. A servicing desk page, a client tab and a dashboard widget, all for holders of "Waive fees".',
    nextSteps: [
      'Give "Waive fees" to the roles that may waive fees (Roles → Extend), e.g. Relationship manager and Senior reviewer (who approve above the limit).',
      'Set each member\'s authority limit (Team → Access → Attributes).',
      'Publish the back office.',
    ],
  },
  { id: 'blank', name: 'Blank back office', category: 'Start from scratch', description: 'No pages, menu items or actions yet.', nextSteps: [] },
] as const;

export const FEE_WAIVER_PERMISSION = 'custom:fees.waive';
export const feeWaiverYaml = () => readFileSync(join(import.meta.dir, 'fee-waiver.yaml'), 'utf8');

const WAIVE = { permissions: [FEE_WAIVER_PERMISSION] };

/** The back office of the template, wired to the workflow created for it. */
export function feeWaiversBackOffice(workflowId: string): BackOfficeDefinition {
  return backOfficeDefinitionSchema.parse({
    name: 'Back office',
    navigation: [{ section: 'Servicing', label: 'Servicing desk', icon: 'hand-coins', page: 'servicing', access: WAIVE }],
    pages: {
      servicing: {
        title: 'Servicing desk', description: 'Fee waivers: what waits for approval and what was refunded', icon: 'hand-coins', access: WAIVE,
        widgets: [
          {
            id: 'servicing-figures', type: 'section', props: { layout: 'grid-3' }, children: [
              { id: 'waiting', type: 'stat', props: { label: 'Waiting for approval', value: "= $count(cases[workflowName = 'Fee waiver' and status = 'in_review'])", format: 'number', icon: 'hourglass' } },
              { id: 'waived', type: 'stat', props: { label: 'Fees waived', value: "= $count(cases[workflowName = 'Fee waiver' and outcome = 'fee_waived'])", format: 'number', icon: 'hand-coins' } },
              { id: 'my-tasks', type: 'stat', access: { permissions: ['tasks:work'] }, props: { label: 'My tasks', value: '= metrics.tasks.mine', format: 'number', icon: 'clipboard-check' } },
            ],
          },
          { id: 'how', type: 'callout', props: { title: 'Waive a fee', text: 'Open the client (Clients) and press **Waive a fee**. Above your authority limit, a senior reviewer approves it first.', tone: 'info' } },
          {
            id: 'recent', type: 'list', props: {
              title: 'Recent fee waivers', source: 'cases', filter: "workflowName = 'Fee waiver'", sort: 'createdAt', descending: true, limit: 15,
              itemTitle: '{{item.applicant.name}}', itemSubtitle: '{{item.reference}} · {{item.status}}', itemValue: '{{item.outcome}}',
              icon: 'hand-coins', empty: 'No fee waiver yet.', page: 'builtin:case', params: { id: '{{item.id}}' },
            },
          },
        ],
      },
      'client-servicing': {
        title: 'Servicing', context: 'client', access: WAIVE,
        widgets: [
          { id: 'client-details', type: 'details', props: { title: 'Client', source: 'client', fields: [{ path: 'name', label: 'Name', format: 'text' }, { path: 'email', label: 'E-mail', format: 'text' }, { path: 'externalId', label: 'Customer number', format: 'text' }] } },
          { id: 'client-waive', type: 'button', props: { label: 'Waive a fee', journey: 'waive_fee', icon: 'hand-coins' } },
          {
            id: 'client-waivers', type: 'list', props: {
              title: 'Fee waivers', source: 'cases', filter: "workflowName = 'Fee waiver'", sort: 'createdAt', descending: true, limit: 10,
              itemTitle: '{{item.reference}}', itemSubtitle: '{{item.status}}', itemValue: '{{item.outcome}}', empty: 'No fee waiver for this client yet.',
              page: 'builtin:case', params: { id: '{{item.id}}' },
            },
          },
          {
            id: 'client-transactions', type: 'table', props: {
              title: 'Recent transactions', source: 'records:transactions', sort: 'date', descending: true, limit: 10,
              columns: [{ field: 'date', label: 'Date', format: 'date' }, { field: 'description', label: 'Description', format: 'text' }, { field: 'category', label: 'Category', format: 'text' }, { field: 'amount', label: 'Amount', format: 'money' }],
            },
          },
        ],
      },
    },
    actions: {
      waive_fee: { label: 'Waive a fee', description: 'Refund a fee to the client\'s account', icon: 'hand-coins', workflowId, context: 'client', presentation: { mode: 'dialog', size: 'md' } },
    },
    slots: {
      dashboard: [
        {
          id: 'dashboard-servicing', type: 'section', access: WAIVE, props: { title: 'Servicing', layout: 'grid-2', card: true }, children: [
            { id: 'dashboard-waiting', type: 'stat', props: { label: 'Fee waivers waiting for approval', value: "= $count(cases[workflowName = 'Fee waiver' and status = 'in_review'])", format: 'number', icon: 'hourglass' } },
            { id: 'dashboard-desk', type: 'button', props: { label: 'Open the servicing desk', page: 'servicing', style: 'outline' } },
          ],
        },
      ],
      client: { actions: [{ action: 'waive_fee' }], tabs: [{ page: 'client-servicing', label: 'Servicing' }] },
    },
  });
}

export async function ensureFeeWaiverPermission(db: TenantDatabase, by: string | null) {
  const [existing] = await db.select().from(customPermissions).where(eq(customPermissions.key, FEE_WAIVER_PERMISSION)).limit(1);
  if (existing) {
    if (existing.archivedAt) await db.update(customPermissions).set({ archivedAt: null }).where(eq(customPermissions.id, existing.id));
    return false;
  }
  await db.insert(customPermissions).values({ key: FEE_WAIVER_PERMISSION, name: 'Waive fees', description: 'Refund fees to clients from the back office (above the authority limit, with approval)', category: 'Servicing', createdByEmail: by });
  return true;
}

export async function ensureAuthorityLimitAttribute(db: TenantDatabase) {
  const [existing] = await db.select().from(memberAttributeDefinitions).where(eq(memberAttributeDefinitions.key, 'authorityLimit')).limit(1);
  if (existing) return false;
  await db.insert(memberAttributeDefinitions).values({ key: 'authorityLimit', label: 'Authority limit (fee waivers)', type: 'number', source: 'manual' });
  return true;
}

/** The template's workflow as a draft (reused when one with its name exists). */
export async function ensureFeeWaiverWorkflow(db: TenantDatabase, by: string) {
  const yaml = feeWaiverYaml();
  const definition = parseDefinition(yaml);
  const [existing] = await db.select({ id: sysWorkflows.id }).from(sysWorkflows).where(eq(sysWorkflows.name, definition.name)).limit(1);
  if (existing) return { id: existing.id, yaml, created: false };
  const [workflow] = await db.insert(sysWorkflows).values({ name: definition.name, description: definition.description.slice(0, 255), yaml, status: 'draft', version: 1, createdBy: by }).returning();
  return { id: workflow.id, yaml, created: true };
}
