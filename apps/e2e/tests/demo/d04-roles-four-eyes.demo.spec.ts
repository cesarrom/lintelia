import { test, expect, type Browser } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus } from '../../support/demo';
import { applyOnSite, loanInstitution } from '../../support/demo-loan';
import type { Institution } from '../../support/scenario';

/** D04 (L05): roles and the two-approver rule. Cast: Amara (reviewer), Luis and Sofia (senior reviewers), Olivia (administrator). */
test.describe.configure({ timeout: 400_000 });
const website = new FakeWebsite('www.northwind-bank.localhost');
let inst: Institution; let members: Awaited<ReturnType<typeof loanInstitution>>['members']; let snippet = '';

test.beforeAll(async ({ browser }) => { await website.start(); ({ inst, members, snippet } = await loanInstitution(browser, website, 'Northwind Bank')); });
test.afterAll(async () => { await website.stop(); await deleteTenant(inst?.bank); });

async function applyQuietly(browser: Browser, a: { name: string; email: string; amount: number; income: number }) {
  const ctx = await browser.newContext();
  const ref = await applyOnSite(await ctx.newPage(), inst, website, snippet, a);
  await ctx.close();
  return ref;
}

test('d04 a large loan needs two different senior reviewers', async ({ browser }) => {
  const reference = await applyQuietly(browser, { name: 'Bo Big', email: 'bo.big@customers.example', amount: 60000, income: 200000 });
  await applyQuietly(browser, { name: 'Mia Mid', email: 'mia.mid@customers.example', amount: 20000, income: 90000 });
  const an = await recordedContext(browser, 'analyst', { app: 'web', session: members.analyst, url: inst.bank.url('/app/tasks'), ready: async (p) => { await expect(p.getByRole('tab', { name: 'Team queue' })).toBeVisible(); } });
  const ap = an.page;
  await beat(ap, 1200);
  scene('First-line reviewers do not see it', 'analyst');
  await ap.getByRole('tab', { name: 'Team queue' }).click();
  await expect(ap.getByTestId('task-row').filter({ hasText: 'Mia Mid' })).toBeVisible({ timeout: 30_000 });
  await expect(ap.getByText('Credit review: Bo Big requests 60000')).toHaveCount(0);
  await focus(ap, ap.getByRole('tab', { name: 'Team queue' }));
  await beat(ap, 7000);
  await still(ap, 'analyst-no-big-loan');
  await unfocus(ap);

  const l1 = await recordedContext(browser, 'lead', { app: 'web', session: members.lead, url: inst.bank.url('/app/tasks'), ready: async (p) => { await expect(p.getByRole('tab', { name: 'Team queue' })).toBeVisible(); } });
  const lp = l1.page;
  scene('First approval', 'lead');
  await lp.getByRole('tab', { name: 'Team queue' }).click();
  const row = lp.getByTestId('task-row').filter({ hasText: reference });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await beat(lp, 2500);
  await row.getByRole('button', { name: 'Claim' }).click();
  await expect(lp).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
  await beat(lp, 1500);
  await lp.getByRole('button', { name: 'Approve' }).click();
  await lp.getByLabel(/Reason|What do you need/).pressSequentially('Verified income and collateral', { delay: 70 });
  await beat(lp, 1200);
  await lp.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(lp.getByTestId('first-approval')).toContainText(members.lead.email);
  await focus(lp, lp.getByTestId('first-approval'));
  await beat(lp, 5500);
  await still(lp, 'lead-first-approval');
  await unfocus(lp);

  scene('The same person cannot approve twice', 'lead');
  await expect(lp.getByRole('button', { name: 'Confirm decision' })).toHaveCount(0);
  await focus(lp, lp.getByTestId('first-approval'));
  await beat(lp, 6500);
  await unfocus(lp);

  const l2 = await recordedContext(browser, 'lead2', { app: 'web', session: members.lead2, url: inst.bank.url('/app/tasks'), ready: async (p) => { await expect(p.getByRole('tab', { name: 'Team queue' })).toBeVisible(); } });
  const l2p = l2.page;
  scene('A different senior approves', 'lead2');
  await l2p.getByRole('tab', { name: 'Team queue' }).click();
  const row2 = l2p.getByTestId('task-row').filter({ hasText: reference });
  await expect(row2).toContainText('Second approval');
  await focus(l2p, row2);
  await beat(l2p, 4000);
  await unfocus(l2p);
  await row2.getByRole('button', { name: 'Open' }).click();
  await expect(l2p.getByTestId('first-approval')).toContainText(members.lead.email);
  await beat(l2p, 3000);
  await l2p.getByRole('button', { name: 'Confirm approval (second approver)' }).click();
  await beat(l2p, 1000);
  await l2p.getByRole('button', { name: 'Confirm decision' }).click();
  await expect(l2p.getByTestId('task-decision')).toContainText('Approve');
  await beat(l2p, 3000);

  scene('Both approvers on record', 'lead2');
  await l2p.getByRole('button', { name: `Open case ${reference}` }).click();
  await expect(l2p.getByTestId('case-status')).toHaveText('Approved');
  await expect(l2p.getByTestId('decision')).toHaveCount(2);
  await focus(l2p, l2p.getByTestId('decision').first());
  await beat(l2p, 6500);
  await still(l2p, 'case-two-decisions');
  await unfocus(l2p);

  const ad = await recordedContext(browser, 'admin', { app: 'web', session: inst.bank.admin, url: inst.bank.url('/app/roles'), ready: async (p) => { await expect(p.getByRole('heading', { name: /Roles/ }).first()).toBeVisible({ timeout: 20_000 }); } });
  const adp = ad.page;
  scene('Roles are permission lists', 'admin');
  await beat(adp, 3000);
  await adp.mouse.wheel(0, 200);
  await beat(adp, 6500);
  await still(adp, 'admin-roles');
  scene('The matrix', 'admin');
  await adp.mouse.wheel(0, -400);
  await adp.getByRole('tab', { name: 'Matrix' }).click();
  await beat(adp, 7000);
  await still(adp, 'admin-matrix');
  endScenes();
  await an.close(); await l1.close(); await l2.close(); await ad.close();
});
