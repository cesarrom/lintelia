import { test, expect } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { clientSignIn } from '../../support/scenario';
import { otpCode, waitForEmail } from '../../support/mailbox';
import { embeddedForm } from '../../support/ui';
import { accountInstitution, ACCOUNT_FORM, caseIdOf } from '../../support/demo-account';
import { beat, endScenes, focus, recordedContext, scene, still, typeSlow, unfocus } from '../../support/demo';

/** D08 (L04): the identity check is inconclusive, a reviewer claims the task, cannot reject without a reason, approves with one. */
test.describe.configure({ timeout: 400_000 });
const website = new FakeWebsite('www.northwind-bank.localhost');

test('d08 an inconclusive identity check goes to a reviewer who decides with a reason', async ({ browser }) => {
  await website.start();
  const { inst, snippet, members } = await accountInstitution(website, { members: { analyst: ['Amara Analyst', 'reviewer'] } });
  try {
    website.page('Open an account', snippet);
    const email = 'noa.newcomer@customers.example';
    // Unrecorded: Noa applies on the bank website.
    const ctx = await browser.newContext();
    const ap = await ctx.newPage();
    await ap.goto(`${website.origin}/apply`);
    const form = await embeddedForm(ap, ACCOUNT_FORM);
    await form.getByLabel('Full name').fill('Noa Newcomer');
    await form.getByLabel('E-mail').fill(email);
    const since = Date.now() - 1000;
    await form.getByRole('button', { name: 'Submit' }).click();
    await expect(form.getByLabel('Verification code')).toBeVisible();
    await form.getByLabel('Verification code').fill(otpCode(await waitForEmail({ tenant: inst.bank.key, to: email, since, subject: /code/i })));
    await form.getByRole('button', { name: 'Confirm' }).click();
    await expect(form.getByTestId('embed-confirmation')).toBeVisible();
    const reference = (await form.getByTestId('application-reference').textContent())!.trim();
    await ctx.close();
    const caseId = await caseIdOf(inst, reference);
    const client = await clientSignIn(inst.bank, email);

    const phone = await recordedContext(browser, 'customer', { app: 'phone', session: client, url: inst.bank.url(`/portal/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('client-request').filter({ hasText: 'Verify your identity' })).toBeVisible({ timeout: 30_000 }); } });
    const pp = phone.page;
    await beat(pp, 1500);
    scene('Inconclusive result (simulated)', 'customer');
    await pp.getByTestId('client-request').filter({ hasText: 'Verify your identity' }).getByTestId('client-action').click({ timeout: 30_000 });
    const didit = pp.frameLocator('iframe[title="Verify your identity"]');
    const manual = didit.getByRole('button', { name: /Send to manual review/ });
    await expect(manual).toBeVisible({ timeout: 20_000 });
    await focus(pp, pp.locator('iframe[title="Verify your identity"]'));
    await beat(pp, 4500);
    await still(pp, 'phone-inconclusive');
    await unfocus(pp);
    await manual.click();
    await beat(pp, 3500);

    const rev = await recordedContext(browser, 'reviewer', { app: 'web', session: members.analyst, url: inst.bank.url('/app/tasks'),
      ready: async (p) => { await expect(p.getByRole('tab', { name: 'Team queue' })).toBeVisible({ timeout: 20_000 }); } });
    const rp = rev.page;
    scene('Team queue, twenty-four hour deadline', 'reviewer');
    await rp.getByRole('tab', { name: 'Team queue' }).click();
    const row = rp.getByTestId('task-row').filter({ hasText: reference });
    await expect(row).toBeVisible({ timeout: 40_000 });
    await focus(rp, row);
    await beat(rp, 5000);
    await still(rp, 'reviewer-queue-kyc');
    await unfocus(rp);

    scene('The reviewer reads the evidence', 'reviewer');
    await row.getByRole('button', { name: 'Claim' }).click();
    await expect(rp).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
    await expect(rp.getByText('in_review').first()).toBeVisible({ timeout: 20_000 });
    await focus(rp, rp.getByText('Verify identity').first().locator('xpath=ancestor::div[3]'));
    await beat(rp, 5500);
    await still(rp, 'reviewer-evidence');
    await unfocus(rp);

    scene('A reason is required', 'reviewer');
    await rp.getByRole('button', { name: 'Reject' }).click();
    await expect(rp.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();
    await focus(rp, rp.getByLabel(/Reason|What do you need/));
    await beat(rp, 4000);
    await unfocus(rp);

    scene('Approved, with a reason', 'reviewer');
    await rp.getByRole('button', { name: 'Approve' }).click();
    await typeSlow(rp.getByLabel(/Reason|What do you need/), 'Name, date of birth and face match the passport');
    await beat(rp, 1500);
    await rp.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(rp.getByTestId('task-decision')).toContainText('Approve');
    await beat(rp, 3500);
    await still(rp, 'reviewer-decided-kyc');

    scene('Decision on the record', 'reviewer');
    await rp.getByRole('button', { name: `Open case ${reference}` }).click();
    await expect(rp.getByTestId('decision').first()).toBeVisible({ timeout: 20_000 });
    await focus(rp, rp.getByTestId('decision').first());
    await beat(rp, 5000);
    await unfocus(rp);
    await rp.mouse.wheel(0, 300);
    await beat(rp, 3500);
    await still(rp, 'reviewer-case-kyc');
    endScenes();
    await phone.close(); await rev.close();
  } finally {
    await website.stop();
    await deleteTenant(inst.bank);
  }
});
