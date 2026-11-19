import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { emailsTo, waitForEmail } from '../../support/mailbox';

/**
 * FIA-19: change control of access (docs/plans/15 §14). Privileged changes notify the administrators; the institution
 * may require a second administrator for changes that grant something (maker-checker); revocations never wait; any
 * change may carry an effective date; the policy itself is protected; the institution cannot lock itself out.
 */
let bank: TenantHandle;
let second: Awaited<ReturnType<typeof addMember>>;
let secondApi: Api;
let member: Awaited<ReturnType<typeof addMember>>;
const roles = async (email: string) => ((await bank.adminApi.get('/users')).body as Array<{ email: string; roles: string[] }>).find((m) => m.email === email)?.roles ?? [];

test.beforeAll(async () => {
  bank = await createTenant();
  member = await addMember(bank, { roles: ['support_agent'], label: 'member' });
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe.configure({ mode: 'serial' });

test.describe('FIA-19 Access changes: notifications, a second approver, effective dates', { tag: ['@fi-admin', '@FIA-19'] }, () => {
  test('privileged changes are told to the administrators; ordinary ones are only logged', async () => {
    let since = Date.now() - 1000;
    expectStatus(await bank.adminApi.put(`/users/${member.user.userId}`, { roleIds: ['support_agent', 'reviewer'] }), 200);
    // Becoming an administrator is worth an e-mail to every administrator.
    second = await addMember(bank, { roles: ['admin'], label: 'second-admin' });
    secondApi = Api.as(second);
    const mail = await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: /Access changed: Invite .*second-admin/, since });
    expect(mail.text).toContain(`Requested by ${bank.adminEmail}`);
    expect(await emailsTo({ tenant: bank.key, to: bank.adminEmail, subject: /Access changed: .*Reviewer/, since })).toHaveLength(0);
    const log = (await bank.adminApi.get('/access-changes')).body as Array<{ kind: string; summary: string; status: string }>;
    expect(log.some((c) => c.kind === 'member.roles' && c.summary.includes('+Reviewer') && c.status === 'applied')).toBe(true);
    since = Date.now();
  });

  test('a second approver needs two people who can approve; the policy change itself is on record', async () => {
    const lonely = await createTenant();
    try {
      const refused = await lonely.adminApi.put('/security/policy', { accessApproval: 'grants' });
      expectStatus(refused, 409);
      expect(refused.body.error).toContain('at least two');
    } finally {
      await deleteTenant(lonely);
    }
    const on = await bank.adminApi.put('/security/policy', { accessApproval: 'grants', accessNotify: ['security-team@bank.example'] });
    expectStatus(on, 200);
    expect(on.body).toMatchObject({ accessApproval: 'grants', accessNotify: ['security-team@bank.example'] });
  });

  test('a grant waits for another administrator, who is told; the requester cannot approve it', async () => {
    const since = Date.now() - 1000;
    const pending = await bank.adminApi.put(`/users/${member.user.userId}`, { roleIds: ['support_agent', 'reviewer', 'auditor'] });
    expectStatus(pending, 202);
    expect(pending.body).toMatchObject({ pending: true, status: 'pending_approval', change: { kind: 'member.roles', grants: true } });
    const change = pending.body.change as { id: string; summary: string };
    expect(change.summary).toContain('+Auditor');
    expect(await roles(member.email)).not.toContain('auditor');
    await waitForEmail({ tenant: bank.key, to: second.email, subject: /waiting for your approval/, since });
    await waitForEmail({ tenant: bank.key, to: 'security-team@bank.example', subject: /waiting for your approval/, since });

    const own = await bank.adminApi.post(`/access-changes/${change.id}/approve`);
    expectForbidden(own);
    expect(own.body.error).toContain('your own change');
    expectForbidden(await Api.as(member).post(`/access-changes/${change.id}/approve`));
    const listed = ((await secondApi.get('/access-changes?status=pending_approval')).body as Array<{ id: string; canApprove: boolean }>).find((c) => c.id === change.id);
    expect(listed?.canApprove).toBe(true);

    const approved = await secondApi.post(`/access-changes/${change.id}/approve`, { reason: 'audit season' });
    expectStatus(approved, 200);
    expect(approved.body).toMatchObject({ status: 'applied', approvedBy: second.email, decisionReason: 'audit season' });
    expect(await roles(member.email)).toContain('auditor');
    const audit = JSON.stringify((await bank.adminApi.get('/audit?action=member.roles_changed')).body);
    expect(audit).toContain(second.email);
  });

  test('revocations apply at once, never waiting for an approval', async () => {
    const revoked = await bank.adminApi.put(`/users/${member.user.userId}`, { roleIds: ['support_agent', 'reviewer'] });
    expectStatus(revoked, 200);
    expect(await roles(member.email)).not.toContain('auditor');
  });

  test('nobody approves their own elevation; a rejection needs a reason and is told to the requester', async () => {
    const since = Date.now() - 1000;
    const forSecond = await bank.adminApi.put(`/users/${second.user.userId}`, { roleIds: ['admin', 'auditor'] });
    expectStatus(forSecond, 202);
    const own = await secondApi.post(`/access-changes/${forSecond.body.change.id}/approve`);
    expectForbidden(own);
    expect(own.body.error).toContain('your own roles');
    expectStatus(await secondApi.post(`/access-changes/${forSecond.body.change.id}/reject`, {}), 400);
    const rejected = await secondApi.post(`/access-changes/${forSecond.body.change.id}/reject`, { reason: 'not needed' });
    expectStatus(rejected, 200);
    expect(rejected.body.status).toBe('rejected');
    await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: /Access change rejected/, since });
    expectStatus(await secondApi.post(`/access-changes/${forSecond.body.change.id}/approve`), 409);
  });

  test('changes can wait for a date: scheduled, cancellable, applied on time', async () => {
    const at = new Date(Date.now() + 4000).toISOString();
    const scheduled = await bank.adminApi.put(`/users/${member.user.userId}`, { roleIds: ['support_agent'], effectiveAt: at });
    expectStatus(scheduled, 202);
    expect(scheduled.body).toMatchObject({ status: 'scheduled', change: { grants: false } });
    expect(await roles(member.email)).toContain('reviewer');
    await expect.poll(async () => roles(member.email), { timeout: 20_000 }).not.toContain('reviewer');
    const applied = (await bank.adminApi.get(`/access-changes/${scheduled.body.change.id}`)).body;
    expect(applied.status).toBe('applied');

    const later = await bank.adminApi.put(`/users/${member.user.userId}`, { roleIds: [], effectiveAt: new Date(Date.now() + 3600_000).toISOString() });
    expectStatus(later, 202);
    const cancelled = await bank.adminApi.post(`/access-changes/${later.body.change.id}/cancel`);
    expectStatus(cancelled, 200);
    expect(cancelled.body.status).toBe('cancelled');
    await new Promise((r) => setTimeout(r, 3000));
    expect(await roles(member.email)).toContain('support_agent');
  });

  test('switching approvals off is itself a change another administrator approves', async () => {
    const off = await bank.adminApi.put('/security/policy', { accessApproval: 'off' });
    expectStatus(off, 202);
    expect((await bank.adminApi.get('/security/policy')).body.accessApproval).toBe('grants');
    expectStatus(await secondApi.post(`/access-changes/${off.body.change.id}/approve`), 200);
    expect((await bank.adminApi.get('/security/policy')).body.accessApproval).toBe('off');
    expectStatus(await bank.adminApi.put('/security/policy', { accessApproval: 'grants' }), 200);
  });

  test('when nobody else can approve, a grant applies with a notice instead of waiting forever', async () => {
    const since = Date.now() - 1000;
    expectStatus(await bank.adminApi.patch(`/users/${second.user.userId}/deactivate`), 200);
    await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: /Administrator deactivated/, since });
    const applied = await bank.adminApi.put(`/users/${member.user.userId}`, { roleIds: ['support_agent', 'auditor'] });
    expectStatus(applied, 200);
    expect(await roles(member.email)).toContain('auditor');
    const change = ((await bank.adminApi.get('/access-changes')).body as Array<{ summary: string; decisionReason: string | null }>)[0];
    expect(change.decisionReason).toContain('without a second approver');
  });
});
