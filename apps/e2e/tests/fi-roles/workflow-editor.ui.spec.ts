import { test, expect } from '@playwright/test';
import YAML from 'yaml';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { personaPage } from '../../support/ui';

test.describe.configure({ timeout: 120_000 });

let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  const created = await Api.as(inst.members.designer).post('/workflow-templates/suspicious-activity/use');
  expectStatus(created, 201);
  workflowId = created.body.id;
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('DES-06 Edit a workflow visually', { tag: ['@flow-designer', '@DES-06'] }, () => {
  test('every step of a template renders with its configuration; a change in the dialog is saved, validated and published', async ({ browser }) => {
    const page = await personaPage(browser, inst.bank.key, inst.members.designer, `/app/workflows/${workflowId}`);
    const nodes = page.getByTestId('workflow-node');
    await expect(nodes).toHaveCount(9, { timeout: 45_000 });
    await expect(page.locator('[data-unknown="true"]')).toHaveCount(0);
    // The step after Start (a case update) and the decisions render their content (the original bug: empty boxes).
    await expect(nodes.filter({ hasText: 'Mark risk' }).getByTestId('node-summary')).toContainText('Risk high');
    await expect(nodes.filter({ hasText: 'SAR filed' }).getByTestId('node-summary')).toContainText('closed · sar_filed');
    const mlro = nodes.filter({ hasText: 'MLRO decision' });
    await expect(mlro.getByTestId('node-summary')).toContainText('Queue compliance_officer');
    await expect(mlro.getByText('High authority')).toBeVisible();

    // Change the triage SLA and add a custom outcome through the generated configuration form.
    await page.getByRole('button', { name: 'Configure Alert triage', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('SLA').fill('PT12H');
    await dialog.getByRole('button', { name: 'Add' }).first().click();
    const outcomes = dialog.getByTestId('outcomes-item');
    await outcomes.last().getByLabel('Key').fill('refer_mlro_directly');
    await outcomes.last().getByLabel('Button label').fill('Refer straight to the MLRO');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    const triage = nodes.filter({ hasText: 'Alert triage' });
    await expect(triage.getByTestId('node-summary')).toContainText('SLA PT12H');
    await expect(triage.getByText('refer_mlro_directly')).toBeVisible();

    // Add a step from the palette.
    await page.getByRole('region', { name: 'Components' }).getByRole('button', { name: 'Wait', exact: true }).click();
    await expect(nodes).toHaveCount(10);

    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await page.getByRole('button', { name: 'Validate' }).click();
    await expect(page.getByTestId('validation-result')).toContainText('Ready to publish');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published as version 1')).toBeVisible();

    const versions = await Api.as(inst.members.designer).get(`/workflows/${workflowId}/versions`);
    expect((versions.body as any[]).map((v) => v.status)).toContain('active');
    const saved = YAML.parse((await Api.as(inst.members.designer).get(`/workflows/${workflowId}`)).body.yaml);
    const savedTriage = saved.steps.find((s: any) => s.id === 'triage');
    expect(savedTriage.config.sla).toBe('PT12H');
    expect(savedTriage.config.outcomes.map((o: any) => o.key)).toContain('refer_mlro_directly');
    expect(savedTriage.events.map((e: any) => e.name)).toContain('refer_mlro_directly');
    // Edges survived the round trip (the triage still leads to the investigation).
    expect(savedTriage.events.find((e: any) => e.name === 'escalate').next).toEqual(['investigation']);
    expect(saved.steps.some((s: any) => s.type === 'wait')).toBe(true);
  });
});
