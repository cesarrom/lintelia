import { test, expect } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution } from '../../support/scenario';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus, demoMember } from '../../support/demo';
import { addClient } from '../../support/factories';

/** D13 (C2): the customer asks for a copy of her data and for erasure; compliance completes the request on the case. */
test.describe.configure({ timeout: 300_000 });

test('d13 data-rights requests', async ({ browser }) => {
  const inst = await prepareInstitution({ name: 'Northwind Bank' });
  try {
    const mlro = await demoMember(inst.bank, 'Carla Compliance', 'compliance_officer');
    const client = await addClient(inst.bank, { name: 'Ada Applicant' });
    const ph = await recordedContext(browser, 'customer', { app: 'phone', session: client, url: inst.bank.url('/portal'),
      ready: async (p) => { await expect(p.getByRole('link', { name: 'Privacy' })).toBeVisible({ timeout: 30_000 }); } });
    const pp = ph.page;
    await pp.getByRole('link', { name: 'Privacy' }).click();
    await expect(pp.getByRole('button', { name: 'Request a copy of my data' })).toBeVisible();
    await beat(pp, 1200);
    scene('Data-rights requests', 'customer');
    await focus(pp, pp.getByRole('button', { name: 'Request a copy of my data' }));
    await beat(pp, 3000);
    await unfocus(pp);
    await pp.getByRole('button', { name: 'Request a copy of my data' }).click();
    await expect(pp.getByTestId('data-request').filter({ hasText: 'Copy of my data' })).toContainText('In progress');
    await beat(pp, 3000);
    pp.once('dialog', (d) => d.accept());
    await pp.getByRole('button', { name: 'Erase my data' }).click();
    await expect(pp.getByTestId('data-request').filter({ hasText: 'Erasure of my data' })).toBeVisible();
    await beat(pp, 4000);
    await still(pp, 'phone-data-rights');

    const cp = await recordedContext(browser, 'team', { app: 'web', session: mlro, url: inst.bank.url('/app/data-requests'),
      ready: async (p) => { await expect(p.getByTestId('data-request-row').first()).toBeVisible({ timeout: 30_000 }); } });
    scene('Completed by compliance', 'team');
    const row = cp.page.getByTestId('data-request-row').filter({ hasText: 'Copy of data' });
    await focus(cp.page, row);
    await beat(cp.page, 3500);
    await row.getByRole('button', { name: 'Prepare export' }).click();
    await expect(cp.page.getByText('Request completed — the client was notified')).toBeVisible();
    await beat(cp.page, 5000);
    await still(cp.page, 'team-data-request');
    await unfocus(cp.page);
    endScenes();
    await ph.close(); await cp.close();
  } finally {
    await deleteTenant(inst.bank);
  }
});
