import { test, expect } from '../../support/test';
import YAML from 'yaml';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, waitForCase, type Institution } from '../../support/scenario';
import { personaPage } from '../../support/ui';

/**
 * AUT-01/02 in the workflow editor (docs/plans/12): a designer gives a workflow its stages and makes it a function with
 * outputs; once published it appears in the palette under "Your functions" and another workflow uses it as a step.
 */
test.describe.configure({ timeout: 150_000 });

let inst: Institution;
let designer: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  designer = Api.as(inst.members.designer);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const draft = async (yaml: string) => {
  const res = await designer.post('/workflows', { yaml });
  expectStatus(res, 201);
  return res.body.id as string;
};

test.describe('AUT-02 Build a function in the editor and use it', { tag: ['@flow-designer', '@AUT-01', '@AUT-02'] }, () => {
  test('stages, function and outputs in the settings survive saving; the function is a step of another workflow', async ({ browser }) => {
    const functionId = await draft(`schemaVersion: "1"
name: "Score a dealer"
description: a score from the number of deals
inputs:
  - { id: deals, name: deals, label: Deals last month, type: number, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [score] }] }
  - { id: score, name: Score, type: calculate, config: { outputs: { tier: "$number(input.deals) >= 20 ? 'gold' : 'standard'" } }, events: [{ name: done, outputs: [], next: [done] }] }
  - { id: done, name: Done, type: case.decision, config: { status: completed, notifyApplicant: false }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`);
    const page = await personaPage(browser, inst.bank.key, inst.members.designer, `/app/workflows/${functionId}`);
    await expect(page.getByTestId('workflow-node')).toHaveCount(3, { timeout: 45_000 });

    await page.getByTestId('wf-settings').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add a stage' }).click();
    await dialog.getByLabel('Stage label').last().fill('Scoring');
    await dialog.getByRole('button', { name: 'Add a stage' }).click();
    await dialog.getByLabel('Stage label').last().fill('Scored');
    await expect(dialog.getByLabel('Stage key').last()).toHaveValue('scored');
    await dialog.getByTestId('wf-function').click();
    await dialog.getByRole('button', { name: 'Add an output' }).click();
    await dialog.getByLabel('Output name').fill('tier');
    await dialog.getByLabel('Output expression').fill('= steps.score.tier');
    await dialog.getByTestId('wf-settings-save').click();
    await expect(page.getByTestId('wf-summary')).toContainText('Function');
    await expect(page.getByTestId('wf-summary')).toContainText('Stages: Scoring → Scored');

    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await expect.poll(async () => YAML.parse((await designer.get(`/workflows/${functionId}`)).body.yaml).function, { timeout: 10_000 }).toBe(true);
    const saved = YAML.parse((await designer.get(`/workflows/${functionId}`)).body.yaml);
    expect(saved.stages).toEqual([{ key: 'scoring', label: 'Scoring' }, { key: 'scored', label: 'Scored' }]);
    expect(saved.outputs).toEqual({ tier: '= steps.score.tier' });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published as version 1')).toBeVisible();

    // Another workflow: the function is in the palette and becomes a step with its input as a field.
    const callerId = await draft(`schemaVersion: "1"
name: "Onboard a dealer"
description: uses the score
inputs: [{ id: deals, name: deals, type: number, required: true }]
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [] }] }
`);
    await page.goto(inst.bank.url(`/app/workflows/${callerId}`));
    const palette = page.getByRole('region', { name: 'Components' });
    await expect(palette.getByText('Your functions')).toBeVisible({ timeout: 30_000 });
    await palette.getByRole('button', { name: 'Score a dealer' }).click();
    const node = page.getByTestId('workflow-node').filter({ hasText: 'Score a dealer' });
    await expect(node).toBeVisible();
    await page.getByRole('button', { name: 'Configure Score a dealer', exact: true }).click();
    const config = page.getByRole('dialog');
    await config.getByLabel('Deals last month').fill('= input.deals');
    await config.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await expect.poll(async () => YAML.parse((await designer.get(`/workflows/${callerId}`)).body.yaml).steps.length, { timeout: 10_000 }).toBe(2);

    // Wire it after Start through the YAML (edges are dragged by hand in the editor) and run it.
    const yaml = YAML.parse((await designer.get(`/workflows/${callerId}`)).body.yaml);
    const step = yaml.steps.find((s: any) => s.type === `function:${functionId}`);
    expect(step.config.inputs).toEqual({ deals: '= input.deals' });
    yaml.steps[0].events[0].next = [step.id];
    expectStatus(await designer.put(`/workflows/${callerId}`, { yaml: YAML.stringify(yaml) }), 200);
    expectStatus(await designer.post(`/workflows/${callerId}/publish`), 200);
    const kase = await inst.bank.adminApi.post('/cases', { workflowId: callerId, inputs: { deals: 25 } });
    expectStatus(kase, 201);
    const done = await waitForCase(inst.bank.adminApi, kase.body.id, (c) => c.status === 'completed', 30_000);
    const results = (await inst.bank.adminApi.get(`/cases?workflowId=${functionId}`)).body as any[];
    expect(results).toHaveLength(1);
    expect(done.status).toBe('completed');
  });
});
