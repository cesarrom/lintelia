import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { env, tenantUrl } from '../../support/env';
import { staffSession } from '../../support/factories';
import { platformUrl } from '../../support/ui';
import { purgeLeftoverTenants, beat, endScenes, focus, recordedContext, scene, unfocus, demoTenant } from '../../support/demo';

/** D07 (edge case): staff suspend an institution, its sign-in page stops knowing it, then staff reactivate it. */
test.describe.configure({ timeout: 300_000 });

test('d07 suspend and reactivate an institution', async ({ browser }) => {
  await purgeLeftoverTenants();
  const bank = await demoTenant('Lakeside Savings', 'lakeside', 'Olivia Owner');
  const staff = await staffSession();
  try {
    const st = await recordedContext(browser, 'staff', { app: 'web', session: staff, url: platformUrl('/app/platform/institutions'),
      ready: async (p) => { await expect(p.getByTestId('institution-row').filter({ hasText: bank.key })).toBeVisible({ timeout: 20_000 }); } });
    const sp = st.page;
    const row = sp.getByTestId('institution-row').filter({ hasText: bank.key });
    scene('An active institution', 'staff');
    await focus(sp, row);
    await beat(sp, 3500);
    await unfocus(sp);
    scene('Staff suspend it', 'staff');
    sp.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Suspend' }).click();
    await expect(row).toContainText('Suspended');
    await focus(sp, row);
    await beat(sp, 3500);
    await unfocus(sp);
    const tn = await recordedContext(browser, 'institution', { app: 'web', url: tenantUrl(bank.key, '/sign-on') });
    scene('Its sign-in page no longer knows it', 'institution');
    await expect(tn.page.getByText(`Unknown institution "${bank.key}.${env.baseDomain}"`)).toBeVisible();
    await beat(tn.page, 4000);
    scene('Staff reactivate it', 'staff');
    await row.getByRole('button', { name: 'Reactivate' }).dispatchEvent('click');
    await expect(row).toContainText('Active');
    await focus(sp, row);
    await beat(sp, 3500);
    await unfocus(sp);
    endScenes();
    await st.close(); await tn.close();
  } finally {
    const s = Api.as(await staffSession());
    await s.put(`/tenants/${bank.key}`, { data: { status: 'suspended' } });
    await s.delete(`/tenants/${bank.key}`);
  }
});
