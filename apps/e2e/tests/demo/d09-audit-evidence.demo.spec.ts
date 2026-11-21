import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { controlFake } from '../../support/fakes';
import { applyAsClient, prepareInstitution, publishForm, waitForCase } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus, demoMember } from '../../support/demo';

/** D09 (L06): the case timeline (hash-chained), the evidence pack export, the institution audit log and its export. */
test.describe.configure({ timeout: 300_000 });

test('d09 the audit trail and the evidence pack', async ({ browser }) => {
  const inst = await prepareInstitution({ name: 'Northwind Bank', connections: ['didit', 'documenso'] });
  try {
    const designer = Api.as(await demoMember(inst.bank, 'Dana Designer', 'flow_designer'));
    const workflowId = await publishWorkflow(designer, workflowFixture('retail-account-opening', {
      DIDIT: inst.connections.didit, DOCUMENSO: inst.connections.documenso, REMIND_AFTER: 'P3D', EXPIRES_AFTER: 'P30D',
    }));
    const { publicKey } = await publishForm(designer, inst.bank, workflowId);
    const email = 'ada.applicant@customers.example';
    await controlFake('didit', '/decisions', { email, decision: 'Approved' });
    await controlFake('documenso', '/signatures', { email, outcome: 'signed' });
    const { caseId } = await applyAsClient(inst.bank, publicKey, { email });
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved', 45_000);

    const ad = await recordedContext(browser, 'admin', { app: 'web', session: inst.bank.admin, url: inst.bank.url(`/app/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('timeline')).toBeVisible({ timeout: 30_000 }); } });
    const p = ad.page;
    await beat(p, 1200);
    scene('Case timeline', 'admin');
    await focus(p, p.getByTestId('timeline'), { dim: 0.2 });
    await beat(p, 6000);
    await still(p, 'case-timeline');
    scene('Hash-chained, tamper-evident', 'admin');
    await p.getByTestId('timeline').evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await focus(p, p.getByText(/Tamper-evident/).first());
    await beat(p, 6500);
    await unfocus(p);
    scene('Evidence pack per case', 'admin');
    await p.evaluate(() => window.scrollTo(0, 0));
    const exportButton = p.getByRole('button', { name: 'Export evidence' });
    await focus(p, exportButton);
    await beat(p, 2500);
    await exportButton.click();
    await expect(p.getByText('Evidence pack exported')).toBeVisible();
    await beat(p, 4500);
    await unfocus(p);
    scene('Institution audit log', 'admin');
    await p.goto(inst.bank.url('/app/audit'));
    await expect(p.locator('[data-action]').first()).toBeVisible({ timeout: 20_000 });
    await beat(p, 7000);
    await still(p, 'audit-log');
    scene('Export for the archive', 'admin');
    const exp = p.getByRole('button', { name: 'Export (JSON Lines)' });
    await focus(p, exp);
    await beat(p, 2500);
    await exp.click();
    await beat(p, 5000);
    await unfocus(p);
    endScenes();
    await ad.close();
  } finally {
    await deleteTenant(inst.bank);
  }
});
