import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { prepareInstitution, waitForCase, type Institution } from '../../support/scenario';
import { claimFromQueue, decideTask, openAsTenantUser } from '../../support/ui';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('REV-01/REV-02 Work the review inbox in the back office', { tag: ['@reviewer', '@REV-01', '@REV-02'] }, () => {
  test('a reviewer claims the task from the team queue, reviews the case and approves with a reason', async ({ page }) => {
    const email = uniqueEmail('inbox', 'customers.example');
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(started, 202);

    await openAsTenantUser(page, inst.bank.key, inst.members.analyst, '/app/tasks');
    await expect(page.getByText('Nothing assigned to you')).toBeVisible();
    await claimFromQueue(page, started.body.reference);
    await expect(page.getByTestId('task-title')).toHaveText('Review application');
    await expect(page.getByTestId('task-assignee')).toHaveText(inst.members.analyst.email);

    // Rejecting needs a reason: the confirm button stays disabled without one.
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();

    await decideTask(page, 'Approve', 'Checked against submitted documents');
    await expect(page.getByTestId('task-decision')).toContainText('Approve');

    const kase = await waitForCase(inst.bank.adminApi, started.body.caseId, (c) => c.status === 'approved');
    expect(kase.decisions[0].by).toBe(inst.members.analyst.email);

    // The task left my inbox.
    await page.goto(inst.bank.url('/app/tasks'));
    await expect(page.getByTestId('task-row').filter({ hasText: started.body.reference })).toHaveCount(0);
  });
});
