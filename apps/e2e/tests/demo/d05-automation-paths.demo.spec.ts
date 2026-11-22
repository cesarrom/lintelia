import { test, expect, type Browser } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus } from '../../support/demo';
import { applyOnSite, loanInstitution } from '../../support/demo-loan';
import { waitForEmail } from '../../support/mailbox';
import type { Institution } from '../../support/scenario';

/** D05 (L07): small loan approved automatically, unaffordable declined automatically, mid-size waits for a person. */
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

test('d05 small loans are decided automatically, larger ones wait for people', async ({ browser }) => {
  const small = await applyQuietly(browser, { name: 'Sam Small', email: 'sam.small@customers.example', amount: 5000, income: 60000 });
  const no = await applyQuietly(browser, { name: 'Una Upton', email: 'una.upton@customers.example', amount: 40000, income: 20000 });
  const mid = await applyQuietly(browser, { name: 'Mia Mid', email: 'mia.mid@customers.example', amount: 20000, income: 90000 });
  await waitForEmail({ tenant: inst.bank.key, to: 'sam.small@customers.example', subject: `Your application ${small}: approved`, timeoutMs: 30_000 });
  await waitForEmail({ tenant: inst.bank.key, to: 'una.upton@customers.example', subject: `Your application ${no}: not approved`, timeoutMs: 30_000 });
  const team = await recordedContext(browser, 'admin', { app: 'web', session: inst.bank.admin, url: inst.bank.url('/app/cases'), ready: async (p) => { await expect(p.getByText(small).first()).toBeVisible({ timeout: 20_000 }); } });
  const tp = team.page;
  await beat(tp, 1200);
  scene('Three applications, three paths', 'admin');
  await focus(tp, tp.getByRole('table').first(), { dim: 0.25 });
  await beat(tp, 7000);
  await still(tp, 'cases-list');
  await unfocus(tp);
  const open = async (ref: string) => { await tp.goto(inst.bank.url('/app/cases')); await tp.getByText(ref).first().click(); };
  scene('Approved automatically', 'admin');
  await open(small);
  await expect(tp.getByTestId('case-status')).toHaveText('Approved', { timeout: 20_000 });
  await focus(tp, tp.getByTestId('case-status'));
  await beat(tp, 7000);
  await still(tp, 'case-auto-approved');
  await unfocus(tp);
  scene('Declined automatically, with an e-mail', 'admin');
  await open(no);
  await expect(tp.getByTestId('case-status')).toBeVisible({ timeout: 20_000 });
  await focus(tp, tp.getByTestId('case-status'));
  await beat(tp, 7000);
  await still(tp, 'case-auto-declined');
  await unfocus(tp);
  scene('In between: a person decides', 'admin');
  await open(mid);
  await expect(tp.getByTestId('case-status')).toBeVisible({ timeout: 20_000 });
  await focus(tp, tp.getByTestId('case-status'));
  await beat(tp, 7500);
  await still(tp, 'case-waiting');
  await unfocus(tp);

  scene('Rules are an editable workflow', 'admin');
  const list = await inst.bank.adminApi.get('/workflows');
  const wf = (list.body as any[]).find((w) => /Personal loan pre-approval/.test(w.name));
  await tp.goto(inst.bank.url(`/app/workflows/${wf.id}`));
  await expect(tp.getByTestId('workflow-node').first()).toBeVisible({ timeout: 45_000 });
  await beat(tp, 3000);
  await focus(tp, tp.getByTestId('workflow-node').first(), { dim: 0.1 });
  await beat(tp, 6000);
  await unfocus(tp);
  await still(tp, 'workflow-canvas');
  endScenes();
  await team.close();
});
