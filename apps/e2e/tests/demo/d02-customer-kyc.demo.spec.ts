import { test, expect } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { clientSignIn } from '../../support/scenario';
import { waitForCase } from '../../support/scenario';
import { otpCode, waitForEmail } from '../../support/mailbox';
import { embeddedForm } from '../../support/ui';
import { accountInstitution, ACCOUNT_FORM, caseIdOf } from '../../support/demo-account';
import { beat, endScenes, focus, recordedContext, scene, still, typeSlow, unfocus } from '../../support/demo';

/**
 * D02 (L03): Ada opens an account from the bank's own website, confirms her e-mail, then on her phone verifies her
 * identity (simulated provider) and signs (simulated provider); the bank's team sees the record.
 */
test.describe.configure({ timeout: 400_000 });
const website = new FakeWebsite('www.northwind-bank.localhost');

test('d02 a customer opens an account: apply, verify, sign, approved', async ({ browser }) => {
  await website.start();
  const { inst, snippet } = await accountInstitution(website);
  try {
    website.page('Open an account', snippet);
    const email = 'ada.applicant@customers.example';
    const site = await recordedContext(browser, 'applicant', { app: 'web', url: `${website.origin}/apply`,
      ready: async (p) => { await embeddedForm(p, ACCOUNT_FORM); } });
    const sp = site.page;
    const form = await embeddedForm(sp, ACCOUNT_FORM);
    await beat(sp, 1500);

    scene("On the bank's own website", 'applicant');
    await focus(sp, sp.locator(`iframe[title="${ACCOUNT_FORM}"]`));
    await beat(sp, 1500);
    await typeSlow(form.getByLabel('Full name'), 'Ada Applicant');
    await typeSlow(form.getByLabel('E-mail'), email);
    await beat(sp, 2500);
    await still(sp, 'site-form');
    await unfocus(sp);
    const since = Date.now() - 1000;
    await form.getByRole('button', { name: 'Submit' }).click();

    scene('E-mail confirmed first', 'applicant');
    await expect(form.getByLabel('Verification code')).toBeVisible();
    await beat(sp, 2500);
    const code = otpCode(await waitForEmail({ tenant: inst.bank.key, to: email, since, subject: /code/i }));
    await typeSlow(form.getByLabel('Verification code'), code);
    await beat(sp, 1500);
    await form.getByRole('button', { name: 'Confirm' }).click();
    await expect(form.getByTestId('embed-confirmation')).toBeVisible();
    const reference = (await form.getByTestId('application-reference').textContent())!.trim();
    await beat(sp, 3500);
    await still(sp, 'site-confirmed');

    const caseId = await caseIdOf(inst, reference);
    const client = await clientSignIn(inst.bank, email);
    const phone = await recordedContext(browser, 'customer', { app: 'phone', session: client, url: inst.bank.url(`/portal/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('client-request').filter({ hasText: 'Verify your identity' })).toBeVisible({ timeout: 30_000 }); } });
    const pp = phone.page;
    await beat(pp, 1500);
    scene('What the bank needs', 'customer');
    await focus(pp, pp.getByTestId('client-request').first());
    await beat(pp, 5000);
    await still(pp, 'phone-requests');
    await unfocus(pp);

    scene('Identity check (simulated provider)', 'customer');
    await pp.getByTestId('client-request').filter({ hasText: 'Verify your identity' }).getByTestId('client-action').click({ timeout: 30_000 });
    const didit = pp.frameLocator('iframe[title="Verify your identity"]');
    await expect(didit.getByRole('button', { name: /Approve/ })).toBeVisible({ timeout: 20_000 });
    await beat(pp, 3500);
    await still(pp, 'phone-verify');
    await didit.getByRole('button', { name: /Approve/ }).click();
    await expect(pp.getByTestId('client-action-finished')).toBeVisible();
    await beat(pp, 2000);

    scene('E-signature (simulated provider)', 'customer');
    await pp.getByTestId('client-request').filter({ hasText: 'Sign your agreement' }).getByTestId('client-action').click({ timeout: 30_000 });
    const doc = pp.frameLocator('iframe[title="Sign your agreement"]');
    await expect(doc.getByRole('heading', { name: 'Retail account agreement' })).toBeVisible({ timeout: 20_000 });
    await beat(pp, 3500);
    await still(pp, 'phone-sign');
    await doc.getByRole('button', { name: 'Sign' }).click();

    scene('Approved, customer told', 'customer');
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved', 30_000);
    await expect(pp.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });
    await beat(pp, 4500);
    await still(pp, 'phone-approved');

    const team = await recordedContext(browser, 'team', { app: 'web', session: inst.bank.admin, url: inst.bank.url(`/app/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('case-file').filter({ hasText: 'signed-' })).toBeVisible({ timeout: 30_000 }); } });
    const tp = team.page;
    scene('One case, full record', 'team');
    await beat(tp, 1500);
    await focus(tp, tp.getByTestId('case-record').first());
    await beat(tp, 5000);
    await unfocus(tp);
    await tp.mouse.wheel(0, 150);
    await beat(tp, 3000);
    await still(tp, 'team-case-record');
    endScenes();
    await site.close(); await phone.close(); await team.close();
  } finally {
    await website.stop();
    await deleteTenant(inst.bank);
  }
});
