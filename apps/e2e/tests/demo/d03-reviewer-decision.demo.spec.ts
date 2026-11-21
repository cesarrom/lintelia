import { test, expect } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { decideTask, personaPage, signInWithCode } from '../../support/ui';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus } from '../../support/demo';
import { applyOnSite, claimFromQueue, loanInstitution } from '../../support/demo-loan';
import { waitForEmail } from '../../support/mailbox';

/** D03: an applicant applies on the bank's website; a reviewer takes the case from the queue and approves with a reason. */
test.describe.configure({ timeout: 400_000 });
const website = new FakeWebsite('www.bank-site.localhost');

test('d03 an applicant applies on the bank website and a reviewer decides', async ({ browser }) => {
  await website.start();
  const { inst, members, snippet } = await loanInstitution(browser, website, 'Northwind Bank');
  try {
    const email = 'mia.mid@customers.example';
    const app = await recordedContext(browser, 'applicant', { app: 'web', url: 'about:blank' });
    const ap = app.page;
    scene('A customer applies on the bank\'s own website', 'applicant');
    const refP = applyOnSite(ap, inst, website, snippet, { name: 'Mia Mid', email, amount: 20000, income: 90000 }, async (p) => { await beat(p, 2500); });
    const reference = await refP;
    scene('The application is confirmed with a code sent by e-mail (simulated)', 'applicant');
    await beat(ap, 3500);
    await still(ap, 'site-confirmation');

    const rev = await recordedContext(browser, 'reviewer', { app: 'web', session: members.analyst, url: inst.bank.url('/app/tasks'),
      ready: async (p) => { await expect(p.getByText('Nothing assigned to you')).toBeVisible(); } });
    const rp = rev.page;
    scene('The case lands in the team queue', 'reviewer');
    await rp.getByRole('tab', { name: 'Team queue' }).click();
    const row = rp.getByTestId('task-row').filter({ hasText: reference });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await focus(rp, row);
    await beat(rp, 3500);
    await still(rp, 'reviewer-queue');
    await unfocus(rp);

    scene('The reviewer claims it and reads the case', 'reviewer');
    await row.getByRole('button', { name: 'Claim' }).click();
    await expect(rp).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
    await expect(rp.getByTestId('calculation')).toContainText('Monthly Payment');
    await focus(rp, rp.getByTestId('calculation'));
    await beat(rp, 4000);
    await still(rp, 'reviewer-task');
    await unfocus(rp);

    scene('Rejecting needs a reason; the reviewer approves and explains why', 'reviewer');
    await rp.getByRole('button', { name: 'Reject' }).click();
    await beat(rp, 2500);
    await rp.getByRole('button', { name: 'Approve' }).click();
    await rp.getByLabel(/Reason|What do you need/).pressSequentially('Income covers the repayments comfortably', { delay: 45 });
    await beat(rp, 1500);
    await rp.getByRole('button', { name: 'Confirm decision' }).click();
    await expect(rp.getByTestId('task-decision')).toContainText('Approve');
    await beat(rp, 3000);
    await still(rp, 'reviewer-decided');

    scene('The case shows who decided and when', 'reviewer');
    await rp.getByRole('button', { name: `Open case ${reference}` }).click();
    await expect(rp.getByTestId('case-status')).toHaveText('Approved');
    await focus(rp, rp.getByTestId('decision').first());
    await beat(rp, 4000);
    await still(rp, 'reviewer-case');
    await unfocus(rp);

    await waitForEmail({ tenant: inst.bank.key, to: email, subject: `Your application ${reference}: approved`, timeoutMs: 20_000 });
    const cust = await recordedContext(browser, 'customer', { app: 'phone', url: 'about:blank' });
    const cp = cust.page;
    await signInWithCode(cp, inst.bank.key, email);
    const card = cp.getByTestId('portal-case').filter({ hasText: reference });
    await expect(card).toContainText('Approved');
    scene('The customer sees the decision in their portal', 'customer');
    await focus(cp, card);
    await beat(cp, 4000);
    await still(cp, 'phone-portal-approved');
    await unfocus(cp);
    endScenes();
    await app.close(); await rev.close(); await cust.close();
  } finally {
    await website.stop();
    await deleteTenant(inst.bank);
  }
});
