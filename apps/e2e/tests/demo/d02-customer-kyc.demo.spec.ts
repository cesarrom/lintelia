import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { applyAsClient, prepareInstitution, publishForm, waitForCase } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus } from '../../support/demo';

/**
 * D02: a new customer opens an account on their phone: verifies their identity (Didit, simulated), signs the
 * agreement (Documenso, simulated) and is approved; the bank's team sees the verification, the signature and the file.
 */
test.describe.configure({ timeout: 300_000 });

test('d02 a customer verifies identity and signs on a phone; the team sees the record', async ({ browser }) => {
  const inst = await prepareInstitution({ name: 'Northwind Bank', members: { designer: 'flow_designer' }, connections: ['didit', 'documenso'] });
  try {
    const designer = Api.as(inst.members.designer);
    const workflowId = await publishWorkflow(designer, workflowFixture('retail-account-opening', {
      DIDIT: inst.connections.didit, DOCUMENSO: inst.connections.documenso, REMIND_AFTER: 'P3D', EXPIRES_AFTER: 'P30D',
    }));
    const { publicKey } = await publishForm(designer, inst.bank, workflowId);
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { email: uniqueEmail('ada.applicant', 'customers.example') });

    const phone = await recordedContext(browser, 'customer', { app: 'phone', session: client, url: inst.bank.url(`/portal/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('client-request').filter({ hasText: 'Verify your identity' })).toBeVisible({ timeout: 30_000 }); } });
    const pp = phone.page;
    await beat(pp, 1500);
    scene('The customer sees what the bank needs from them', 'customer');
    await focus(pp, pp.getByTestId('client-request').first());
    await beat(pp, 3500);
    await still(pp, 'phone-requests');
    await unfocus(pp);

    scene('Verify identity on the verification page (simulated provider)', 'customer');
    await pp.getByTestId('client-request').filter({ hasText: 'Verify your identity' }).getByTestId('client-action').click({ timeout: 30_000 });
    const didit = pp.frameLocator('iframe[title="Verify your identity"]');
    await expect(didit.getByRole('button', { name: /Approve/ })).toBeVisible({ timeout: 20_000 });
    await beat(pp, 3500);
    await still(pp, 'phone-verify');
    await didit.getByRole('button', { name: /Approve/ }).click();
    await expect(pp.getByTestId('client-action-finished')).toBeVisible();
    await beat(pp, 2500);

    scene('Sign the agreement (simulated provider)', 'customer');
    await pp.getByTestId('client-request').filter({ hasText: 'Sign your agreement' }).getByTestId('client-action').click({ timeout: 30_000 });
    const doc = pp.frameLocator('iframe[title="Sign your agreement"]');
    await expect(doc.getByRole('heading', { name: 'Retail account agreement' })).toBeVisible({ timeout: 20_000 });
    await beat(pp, 3000);
    await still(pp, 'phone-sign');
    await doc.getByRole('button', { name: 'Sign' }).click();

    scene('Approved: the customer is told', 'customer');
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved', 30_000);
    await expect(pp.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });
    await beat(pp, 3500);
    await still(pp, 'phone-approved');

    const team = await recordedContext(browser, 'team', { app: 'web', session: inst.bank.admin, url: inst.bank.url(`/app/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('case-record').first()).toBeVisible({ timeout: 20_000 }); } });
    const tp = team.page;
    scene('The team sees the verification, the signature and the signed file', 'team');
    await beat(tp, 2000);
    await expect(tp.getByTestId('case-file').filter({ hasText: 'signed-' })).toBeVisible({ timeout: 20_000 });
    await focus(tp, tp.getByTestId('case-record').first());
    await beat(tp, 4000);
    await unfocus(tp);
    await still(tp, 'team-case-record');
    await beat(tp, 2000);
    endScenes();
    await phone.close(); await team.close();
  } finally {
    await deleteTenant(inst.bank);
  }
});
