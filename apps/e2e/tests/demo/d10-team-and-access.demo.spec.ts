import { test, expect } from '@playwright/test';
import { deleteTenant, acceptInvitation } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { prepareInstitution } from '../../support/scenario';
import { personaPage } from '../../support/ui';
import { beat, endScenes, focus, recordedContext, scene, still, typeSlow, unfocus, demoMember } from '../../support/demo';

/** D10 (L08): team page, inviting a reviewer, the reviewer's shorter menu, a sensitive change that needs a second administrator. */
test.describe.configure({ timeout: 400_000 });

test('d10 team, roles and a second approver', async ({ browser }) => {
  const inst = await prepareInstitution({ name: 'Northwind Bank' });
  try {
    await demoMember(inst.bank, 'Dana Designer', 'flow_designer');
    await demoMember(inst.bank, 'Amara Analyst', 'reviewer');
    await demoMember(inst.bank, 'Luis Lead', 'senior_reviewer');
    const second = await demoMember(inst.bank, 'Omar Owner', 'admin');
    await demoMember(inst.bank, 'Sam Support', 'support_agent');
    const ol = await recordedContext(browser, 'admin', { app: 'web', session: inst.bank.admin, url: inst.bank.url('/app/users'),
      ready: async (p) => { await expect(p.getByTestId('member-row').first()).toBeVisible({ timeout: 20_000 }); } });
    const op = ol.page;
    await beat(op, 1200);
    scene('Team and roles', 'admin');
    await focus(op, op.getByRole('table').first(), { dim: 0.2 });
    await beat(op, 7000);
    await still(op, 'team-members');
    await unfocus(op);

    scene('Invite a reviewer', 'admin');
    const email = `ravi.reviewer@${inst.bank.key}.example`;
    await typeSlow(op.getByLabel('Email'), email);
    await typeSlow(op.getByLabel('Name'), 'Ravi Reviewer');
    await op.getByRole('combobox', { name: 'Role', exact: true }).click();
    await op.getByRole('option', { name: 'Reviewer', exact: true }).click();
    await beat(op, 1500);
    const since = Date.now() - 1000;
    await op.getByRole('button', { name: 'Send invitation' }).click();
    await expect(op.getByText(`Invitation sent to ${email}`)).toBeVisible();
    await beat(op, 3500);

    // Ravi accepts (unrecorded, so no activation link or token is on camera) and signs in.
    const mail = await waitForEmail({ tenant: inst.bank.key, to: email, since });
    linkWithParam(mail, 'invitation');
    const ravi = await acceptInvitation({ tenant: inst.bank.key, email, since, name: 'Ravi Reviewer' });
    const rv = await recordedContext(browser, 'invitee', { app: 'web', session: ravi, url: inst.bank.url('/app/dashboard'),
      ready: async (p) => { await expect(p.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tasks' })).toBeVisible({ timeout: 20_000 }); } });
    scene('A reviewer sees less', 'invitee');
    await focus(rv.page, rv.page.getByRole('navigation', { name: 'Main' }), { dim: 0.2 });
    await beat(rv.page, 7500);
    await still(rv.page, 'reviewer-menu');
    await unfocus(rv.page);

    // Policy: a second administrator for changes that grant access (set unrecorded).
    const setup = await personaPage(browser, inst.bank.key, inst.bank.admin, '/app/settings?tab=security');
    await setup.getByLabel('Require a second administrator for changes that grant access').click();
    await expect(setup.getByText('A second administrator is now required')).toBeVisible();
    await setup.context().close();

    scene('Sensitive changes need a second approver', 'admin');
    const sam = op.getByTestId('member-row').filter({ hasText: 'sam.support' });
    await op.reload();
    await sam.getByRole('combobox', { name: /Role of/ }).click();
    await op.getByRole('option', { name: 'Auditor' }).click();
    await expect(op.getByText('Sent for approval: another administrator must approve it')).toBeVisible();
    await beat(op, 3000);
    await op.goto(inst.bank.url('/app/access-changes'));
    const change = op.getByTestId('access-change').first();
    await expect(change).toBeVisible({ timeout: 20_000 });
    await focus(op, change);
    await beat(op, 6500);
    await still(op, 'access-change-pending');
    await unfocus(op);

    const sd = await recordedContext(browser, 'admin2', { app: 'web', session: second, url: inst.bank.url('/app/access-changes'),
      ready: async (p) => { await expect(p.getByTestId('access-change').first()).toBeVisible({ timeout: 20_000 }); } });
    const sp = sd.page;
    scene('Approved, applied, logged', 'admin2');
    await beat(sp, 2500);
    await sp.getByTestId('access-change').first().getByRole('button', { name: 'Approve' }).click();
    await beat(sp, 1200);
    await sp.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(sp.getByText('Approved', { exact: true })).toBeVisible();
    await beat(sp, 4000);
    await sp.goto(inst.bank.url('/app/audit'));
    await expect(sp.locator('[data-action]').first()).toBeVisible({ timeout: 20_000 });
    await beat(sp, 7000);
    await still(sp, 'audit-after-approval');
    endScenes();
    await ol.close(); await rv.close(); await sd.close();
  } finally {
    await deleteTenant(inst.bank);
  }
});
