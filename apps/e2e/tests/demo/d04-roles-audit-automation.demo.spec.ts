import { test, expect, type Browser } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { personaPage } from '../../support/ui';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus } from '../../support/demo';
import { applyOnSite, loanInstitution } from '../../support/demo-loan';
import { waitForEmail } from '../../support/mailbox';
import type { Institution } from '../../support/scenario';

/** D04 four-eyes approval, roles and audit trail; D05 automatic decisions next to manual ones. One institution. */
test.describe.configure({ mode: 'serial', timeout: 400_000 });
const website = new FakeWebsite('www.bank-site.localhost');
let inst: Institution; let members: Awaited<ReturnType<typeof loanInstitution>>['members']; let snippet = '';

test.beforeAll(async ({ browser }) => {
  await website.start();
  ({ inst, members, snippet } = await loanInstitution(browser, website, 'Northwind Bank'));
});
test.afterAll(async () => { await website.stop(); await deleteTenant(inst?.bank); });

async function applyQuietly(browser: Browser, a: { name: string; email: string; amount: number; income: number }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ref = await applyOnSite(page, inst, website, snippet, a);
  await ctx.close();
  return ref;
}

test('d04 a large loan needs two different senior reviewers; roles and the audit trail', async ({ browser }) => {
  const reference = await applyQuietly(browser, { name: 'Bo Big', email: 'bo.big@customers.example', amount: 60000, income: 200000 });
  const an = await recordedContext(browser, 'analyst', { app: 'web', session: members.analyst, url: inst.bank.url('/app/tasks'), ready: async (p) => { await expect(p.getByText('Nothing assigned to you')).toBeVisible(); } });
  const ap = an.page;
  scene('A first-line reviewer cannot see a loan above fifty thousand', 'analyst');
  await ap.getByRole('tab', { name: 'Team queue' }).click();
  await beat(ap, 2000);
  await expect(ap.getByText('Credit review: Bo Big requests 60000')).toHaveCount(0);
  await focus(ap, ap.getByRole('tab', { name: 'Team queue' }));
  await beat(ap, 4000);
  await still(ap, 'analyst-no-big-loan');
  await unfocus(ap);

  const l1 = await recordedContext(browser, 'lead', { app: 'web', session: members.lead, url: inst.bank.url('/app/tasks'), ready: async (p) => { await expect(p.getByRole('tab', { name: 'Team queue' })).toBeVisible(); } });
  const lp = l1.page;
  scene('A senior reviewer claims it and gives the first approval', 'lead');
  await lp.getByRole('tab', { name: 'Team queue' }).click();
  const row = lp.getByTestId('task-row').filter({ hasText: reference });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await beat(lp, 2500);
  await row.getByRole('button', { name: 'Claim' }).click();
  await expect(lp).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
  await beat(lp, 2000);
  await lp.getByRole('button', { name: 'Approve' }).click();
  await lp.getByLabel(/Reason|What do you need/).pressSequentially('Verified income and collateral', { delay: 45 });
  await lp.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(lp.getByTestId('first-approval')).toContainText(members.lead.email);
  await focus(lp, lp.getByTestId('first-approval'));
  await beat(lp, 3500);
  await still(lp, 'lead-first-approval');
  await unfocus(lp);

  scene('The same person cannot give the second approval', 'lead');
  await expect(lp.getByRole('button', { name: 'Confirm decision' })).toHaveCount(0);
  await beat(lp, 3500);

  const l2 = await recordedContext(browser, 'lead2', { app: 'web', session: members.lead2, url: inst.bank.url('/app/tasks'), ready: async (p) => { await expect(p.getByRole('tab', { name: 'Team queue' })).toBeVisible(); } });
  const l2p = l2.page;
  scene('A different senior reviewer gives the second approval', 'lead2');
  await l2p.getByRole('tab', { name: 'Team queue' }).click();
  const row2 = l2p.getByTestId('task-row').filter({ hasText: reference });
  await expect(row2).toContainText('Second approval');
  await focus(l2p, row2);
  await beat(l2p, 3000);
  await unfocus(l2p);
  await row2.getByRole('button', { name: 'Open' }).click();
  await expect(l2p.getByTestId('first-approval')).toContainText(members.lead.email);
  await beat(l2p, 2500);
  await l2p.getByRole('button', { name: 'Confirm approval (second approver)' }).click();
  await l2p.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(l2p.getByTestId('task-decision')).toContainText('Approve');
  await beat(l2p, 2500);

  scene('The case records both approvers', 'lead2');
  await l2p.getByRole('button', { name: `Open case ${reference}` }).click();
  await expect(l2p.getByTestId('case-status')).toHaveText('Approved');
  await expect(l2p.getByTestId('decision')).toHaveCount(2);
  await focus(l2p, l2p.getByTestId('decision').first());
  await beat(l2p, 4500);
  await still(l2p, 'case-two-decisions');
  await unfocus(l2p);

  const ad = await recordedContext(browser, 'admin', { app: 'web', session: inst.bank.admin, url: inst.bank.url('/app/roles'), ready: async (p) => { await expect(p.getByRole('heading', { name: /Roles/ }).first()).toBeVisible({ timeout: 20_000 }); } });
  const adp = ad.page;
  scene('Roles decide who can see and do what', 'admin');
  await beat(adp, 4500);
  await still(adp, 'admin-roles');
  scene('The audit log keeps who did what and when', 'admin');
  await adp.goto(inst.bank.url('/app/audit'));
  await expect(adp.locator('[data-action]').first()).toBeVisible({ timeout: 20_000 });
  await beat(adp, 4500);
  await still(adp, 'admin-audit');
  endScenes();
  await an.close(); await l1.close(); await l2.close(); await ad.close();
});

test('d05 small loans are decided automatically, larger ones wait for people', async ({ browser }) => {
  const small = await applyQuietly(browser, { name: 'Sam Small', email: 'sam.small@customers.example', amount: 5000, income: 60000 });
  const no = await applyQuietly(browser, { name: 'Una Affordable', email: 'una.affordable@customers.example', amount: 40000, income: 20000 });
  const mid = await applyQuietly(browser, { name: 'Mia Mid', email: 'mia.mid@customers.example', amount: 20000, income: 90000 });
  await waitForEmail({ tenant: inst.bank.key, to: 'sam.small@customers.example', subject: `Your application ${small}: approved`, timeoutMs: 30_000 });
  await waitForEmail({ tenant: inst.bank.key, to: 'una.affordable@customers.example', subject: `Your application ${no}: not approved`, timeoutMs: 30_000 });
  const team = await recordedContext(browser, 'admin', { app: 'web', session: inst.bank.admin, url: inst.bank.url('/app/cases'), ready: async (p) => { await expect(p.getByText(small).first()).toBeVisible({ timeout: 20_000 }); } });
  const tp = team.page;
  scene('Three applications, three paths', 'admin');
  await focus(tp, tp.getByText(small).first().locator('xpath=ancestor::tr[1]'), { dim: 0.2 }).catch(() => undefined);
  await beat(tp, 5000);
  await unfocus(tp);
  await still(tp, 'cases-list');
  scene('The affordable small loan was approved with no human step', 'admin');
  await tp.getByText(small).first().click();
  await expect(tp.getByTestId('case-status')).toHaveText('Approved', { timeout: 20_000 });
  await beat(tp, 4500);
  await still(tp, 'case-auto-approved');
  scene('The unaffordable one was declined automatically, with a polite e-mail', 'admin');
  await tp.goto(inst.bank.url('/app/cases'));
  await tp.getByText(no).first().click();
  await beat(tp, 4500);
  await still(tp, 'case-auto-declined');
  scene('The mid-size one waits in the team queue for a person', 'admin');
  await tp.goto(inst.bank.url('/app/cases'));
  await tp.getByText(mid).first().click();
  await beat(tp, 4500);
  await still(tp, 'case-waiting');
  endScenes();
  await team.close();
});
