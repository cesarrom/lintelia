import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { staffSession } from '../../support/factories';
import { env } from '../../support/env';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { completeSecondFactor, platformUrl } from '../../support/ui';
import { beat, endScenes, focus, recordedContext, scene, still, typeSlow, unfocus } from '../../support/demo';

/**
 * D01: platform staff onboard a financial institution; its administrator activates the account from the e-mailed
 * invitation, enrols a second factor and lands in the new workspace. Everything is the product's own UI;
 * the invitation e-mail is read in the stack's local mailbox (e-mail is simulated).
 */
test.describe.configure({ timeout: 300_000 });

const KEY = `harbor-credit-${Date.now().toString(36).slice(-4)}`;
const NAME = 'Harbor Credit Union';
const ADMIN = `olivia.owner@${KEY}.example`;

test.afterAll(async () => {
  const staff = Api.as(await staffSession());
  await staff.put(`/tenants/${KEY}`, { data: { status: 'suspended' } });
  await staff.delete(`/tenants/${KEY}`);
});

test('d01 platform staff onboard an institution and its administrator activates the workspace', async ({ browser }) => {
  const staffSess = await staffSession();
  const staff = await recordedContext(browser, 'staff', {
    app: 'web', session: staffSess, url: platformUrl('/app/platform/institutions'),
    ready: async (p) => { await expect(p.getByRole('heading', { name: 'Institutions' })).toBeVisible(); },
  });
  const sp = staff.page;
  await beat(sp, 1500);

  scene('Platform staff see every institution', 'staff');
  await focus(sp, sp.getByTestId('institution-row').first(), { dim: 0.25 });
  await beat(sp, 3500);
  await unfocus(sp);
  await still(sp, 'staff-institutions');

  scene('Onboard a new institution', 'staff');
  await sp.getByRole('button', { name: 'Onboard institution' }).click();
  const dialog = sp.getByRole('dialog');
  await beat(sp, 1200);
  await typeSlow(dialog.getByLabel('Institution name'), NAME);
  await typeSlow(dialog.getByLabel('Workspace key'), KEY);
  await typeSlow(dialog.getByLabel('Administrator e-mail'), ADMIN);
  await beat(sp, 1500);
  await still(sp, 'staff-onboard-dialog');
  const since = Date.now() - 1000;
  await dialog.getByRole('button', { name: 'Create workspace' }).click();

  scene('The workspace exists and the administrator is invited', 'staff');
  await expect(sp.getByText(`invitation sent to ${ADMIN}`)).toBeVisible();
  const row = sp.getByTestId('institution-row').filter({ hasText: KEY });
  await expect(row).toContainText('Active');
  await focus(sp, row);
  await beat(sp, 3500);
  await still(sp, 'staff-institution-created');
  await unfocus(sp);

  // The invitation, as the local mailbox received it.
  const mail = await waitForEmail({ tenant: KEY, to: ADMIN, since });
  const mailbox = await recordedContext(browser, 'mailbox', { app: 'web', url: `${env.mailboxUrl}/?to=${encodeURIComponent(ADMIN)}`, ready: async (p) => { await expect(p.getByText(ADMIN).first()).toBeVisible(); } });
  const mp = mailbox.page;
  scene('The invitation arrives by e-mail (local mailbox)', 'mailbox');
  await beat(mp, 2500);
  await mp.getByRole('link', { name: /Invitation to join/ }).click();
  await beat(mp, 3500);
  await still(mp, 'mailbox-invitation');

  const { url } = linkWithParam(mail, 'invitation');
  const admin = await recordedContext(browser, 'admin', { app: 'web', url: url.toString(), ready: async (p) => { await expect(p.getByLabel('Full name')).toBeVisible(); } });
  const ap = admin.page;
  scene('The administrator opens the invitation and sets a password', 'admin');
  await beat(ap, 1800);
  await typeSlow(ap.getByLabel('Full name'), 'Olivia Owner');
  await typeSlow(ap.getByLabel(/^Password/), 'owner-password-123');
  await beat(ap, 1000);
  await still(ap, 'admin-activate');
  await ap.getByRole('button', { name: 'Activate account' }).click();

  scene('A second factor is required for a new institution', 'admin');
  const code = ap.getByLabel('Authentication code');
  await expect(code).toBeVisible({ timeout: 20_000 });
  await beat(ap, 3500);
  await still(ap, 'admin-second-factor');
  await completeSecondFactor(ap, ADMIN);

  scene('The new workspace is ready', 'admin');
  await expect(ap).toHaveURL(/\/app\/dashboard$/);
  await beat(ap, 3500);
  await still(ap, 'admin-dashboard');
  await ap.goto(`${url.origin}/app/users`);
  await expect(ap.getByRole('cell', { name: ADMIN })).toBeVisible();
  await beat(ap, 3000);
  await still(ap, 'admin-users');

  scene('Every step is in the platform audit log', 'staff');
  await sp.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Audit log' }).click();
  await expect(sp.getByTestId('platform-audit-row').first()).toBeVisible();
  await beat(sp, 4000);
  await still(sp, 'staff-audit-log');

  endScenes();
  await staff.close(); await mailbox.close(); await admin.close();
});
