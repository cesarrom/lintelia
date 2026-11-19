import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus, type Session } from '../../support/api';
import { acceptInvitation, addMember, createTenant, deleteTenant, staffSession, uniqueEmail, type TenantHandle } from '../../support/factories';
import { workflowFixture } from '../../support/workflows';
import { idpUser, setUpSso, ssoSignInWithoutBrowser } from '../../support/sso';
import { waitForEmail } from '../../support/mailbox';

/**
 * FIA-15: administrators see who sees what — the roles × permissions matrix, what a role opens, who holds a
 * permission, what a member can see and do, an export for access reviews (docs/plans/15 §6). FIA-17: member
 * attributes, by hand or from the identity provider, and conditions on them (§5.5). FIA-18: time-bound roles (§5.6).
 * STAFF-08: platform staff restore an administrator of an institution that locked itself out (§14).
 */
let bank: TenantHandle;
let reviewer: Awaited<ReturnType<typeof addMember>>;
let workflowId: string;
let domain: string;

test.beforeAll(async () => {
  bank = await createTenant();
  domain = `${bank.key}.corp.example`;
  reviewer = await addMember(bank, { roles: ['reviewer'], label: 'reviewer' });
  expectStatus(await bank.adminApi.post('/permissions/custom', { name: 'Open branch accounts', key: 'custom:branch.accounts' }), 201);
  expectStatus(await bank.adminApi.put('/roles/reviewer', { customPermissions: ['custom:branch.accounts'] }), 200);
  const yaml = `${workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'P1D' }).replace('name: Manual review', 'name: Branch account')}
access:
  start: { permissions: ["custom:branch.accounts"], when: "member.attributes.region = 'EU'" }
`;
  const created = await bank.adminApi.post('/workflows', { yaml });
  workflowId = created.body.id;
  expectStatus(await bank.adminApi.post(`/workflows/${workflowId}/publish`), 200);
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe.configure({ mode: 'serial' });

test.describe('FIA-15 Who sees what', { tag: ['@fi-admin', '@FIA-15'] }, () => {
  test('the matrix lists every role against built-in and custom permissions', async () => {
    const matrix = (await bank.adminApi.get('/access/matrix')).body as { permissions: Array<{ id: string }>; roles: Array<{ key: string; permissions: string[] }> };
    expect(matrix.permissions.map((p) => p.id)).toEqual(expect.arrayContaining(['cases:read', 'custom:branch.accounts']));
    expect(matrix.roles.find((r) => r.key === 'reviewer')!.permissions).toEqual(expect.arrayContaining(['tasks:work', 'custom:branch.accounts']));
    expect(matrix.roles.find((r) => r.key === 'admin')!.permissions).toContain('custom:branch.accounts');
  });

  test('a role shows its members, the queues it works and the workflows its holders may start', async () => {
    const members = (await bank.adminApi.get('/roles/reviewer/members')).body as Array<{ email: string; source: string }>;
    expect(members).toEqual([expect.objectContaining({ email: reviewer.email, source: 'manual' })]);
    const usage = (await bank.adminApi.get('/roles/reviewer/usage')).body;
    const wf = (usage.workflows as Array<{ id: string; queues: string[]; escalations: string[]; start: string }>).find((w) => w.id === workflowId)!;
    expect(wf.queues).toEqual(['Onboarding review']);
    // The start rule also depends on a condition on the member: it depends on who.
    expect(wf.start).toBe('conditional');
    const senior = (await bank.adminApi.get('/roles/senior_reviewer/usage')).body;
    expect((senior.workflows as Array<{ id: string; escalations: string[] }>).find((w) => w.id === workflowId)!.escalations).toEqual(['Onboarding review']);
    const roles = (await bank.adminApi.get('/roles')).body as Array<{ key: string; members: number; privileged: boolean }>;
    expect(roles.find((r) => r.key === 'reviewer')).toMatchObject({ members: 1, privileged: false });
    expect(roles.find((r) => r.key === 'admin')).toMatchObject({ members: 1, privileged: true });
  });

  test('who holds a permission: roles, members through them, API clients, and the workflows that require it', async () => {
    expectStatus(await bank.adminApi.post('/api-clients', { name: 'Branch system', permissions: ['custom:branch.accounts'] }), 201);
    const who = (await bank.adminApi.get(`/access/who?permission=${encodeURIComponent('custom:branch.accounts')}`)).body;
    expect(who.roles.map((r: { key: string }) => r.key).sort()).toEqual(['admin', 'reviewer']);
    expect(who.members.map((m: { email: string }) => m.email).sort()).toEqual([bank.adminEmail, reviewer.email].sort());
    expect(who.apiClients).toEqual([expect.objectContaining({ name: 'Branch system' })]);
    expect(who.workflows).toEqual([expect.objectContaining({ id: workflowId, start: true })]);
    expectForbidden(await Api.as(reviewer).get(`/access/who?permission=cases:read`));
  });

  test('a member’s access: roles with their origin, permissions, what they may start, the queues they work', async () => {
    const access = (await bank.adminApi.get(`/users/${reviewer.user.userId}/access`)).body;
    expect(access.roles).toEqual([expect.objectContaining({ key: 'reviewer', source: 'manual' })]);
    expect(access.permissions).toEqual(expect.arrayContaining(['tasks:work', 'custom:branch.accounts']));
    expect(access.queues).toEqual([expect.objectContaining({ workflow: 'Branch account', role: 'reviewer' })]);
    // No region yet: the condition keeps the workflow out of reach.
    expect(access.startable.map((w: { id: string }) => w.id)).not.toContain(workflowId);
  });

  test('an export of every assignment for access reviews, itself audited', async () => {
    const res = await fetch(new URL('/access/export', process.env.E2E_API_URL ?? 'http://localhost:8000'), { headers: { Authorization: `Bearer ${bank.admin.token}`, 'X-Tenant': bank.key } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const csv = await res.text();
    expect(csv.split('\n')[0]).toBe('member,name,status,role,role_name,source,idp_groups,expires_at,granted_by,since,permissions');
    expect(csv).toContain(`"${reviewer.email}"`);
    expect(JSON.stringify((await bank.adminApi.get('/audit?action=access.exported')).body)).toContain(bank.adminEmail);
  });
});

test.describe('FIA-17 Member attributes and conditions', { tag: ['@fi-admin', '@FIA-17'] }, () => {
  test('the institution declares attributes: by hand, or read from the identity provider', async () => {
    const saved = await bank.adminApi.put('/member-attributes', {
      attributes: [
        { key: 'branch', label: 'Branch', type: 'select', options: ['Madrid', 'Lisbon'] },
        { key: 'region', label: 'Region', type: 'text', source: 'idp', ssoClaim: 'region', scimAttribute: '"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User".division' },
      ],
    });
    expectStatus(saved, 200);
    expectStatus(await bank.adminApi.put('/member-attributes', { attributes: [{ key: 'bad key', label: 'x' }] }), 400);
    expectStatus(await bank.adminApi.patch(`/users/${reviewer.user.userId}/attributes`, { branch: 'Madrid' }), 200);
    expectStatus(await bank.adminApi.patch(`/users/${reviewer.user.userId}/attributes`, { branch: 'Paris' }), 400);
    const idpOnly = await bank.adminApi.patch(`/users/${reviewer.user.userId}/attributes`, { region: 'EU' });
    expectStatus(idpOnly, 409);
    expect(idpOnly.body.error).toContain('identity provider');
  });

  test('an SSO sign-in brings the IdP’s attributes; a condition on them decides who may start a workflow', async () => {
    await setUpSso(bank, { domain });
    expectStatus(await bank.adminApi.put('/sso/settings', { jit: { enabled: true, defaultRoles: ['reviewer'] } }), 200);
    const signIn = async (email: string, region: string) => {
      await idpUser(email, { claims: { region } });
      const discover = await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent(email)}`);
      const back = await ssoSignInWithoutBrowser(discover.body.redirectUrl, email);
      const session = await Api.anonymous(bank.key).post('/auth/sso/exchange', { code: back.searchParams.get('sso') });
      expectStatus(session, 200);
      return session.body as Session;
    };
    const eu = Api.as(await signIn(`eu.banker@${domain}`, 'EU'));
    const us = Api.as(await signIn(`us.banker@${domain}`, 'US'));
    expect((await eu.get('/auth/me')).body.user.attributes).toMatchObject({ region: 'EU' });
    expect(((await eu.get('/workflows/startable')).body as Array<{ id: string }>).map((w) => w.id)).toContain(workflowId);
    expect(((await us.get('/workflows/startable')).body as Array<{ id: string }>).map((w) => w.id)).not.toContain(workflowId);
    expectStatus(await eu.post(`/workflows/${workflowId}/executions`, { inputs: { email: 'x@y.example' } }), 202);
    expectForbidden(await us.post(`/workflows/${workflowId}/executions`, { inputs: { email: 'x@y.example' } }));
    expect(JSON.stringify((await bank.adminApi.get('/audit?action=member.attributes_synced')).body)).toContain(`eu.banker@${domain}`);
  });
});

test.describe('FIA-18 Time-bound roles', { tag: ['@fi-admin', '@FIA-18'] }, () => {
  test('a role given until a date stops counting then, and its end is on record', async () => {
    const cover = await addMember(bank, { roles: ['support_agent'], label: 'cover' });
    const until = new Date(Date.now() + 4000).toISOString();
    expectStatus(await bank.adminApi.put(`/users/${cover.user.userId}`, { roleIds: ['support_agent', 'senior_reviewer'], expires: { senior_reviewer: until } }), 200);
    const me = async () => (await Api.as(cover).get('/auth/me')).body.permissions as string[];
    expect(await me()).toContain('cases:approve_high_risk');
    const listed = ((await bank.adminApi.get('/users')).body as Array<{ email: string; assignments: Array<{ role: string; expiresAt: string | null }> }>).find((m) => m.email === cover.email)!;
    expect(listed.assignments.find((a) => a.role === 'senior_reviewer')!.expiresAt).toBeTruthy();
    await expect.poll(me, { timeout: 15_000 }).not.toContain('cases:approve_high_risk');
    await expect.poll(async () => JSON.stringify((await bank.adminApi.get('/audit?action=member.role_expired')).body), { timeout: 15_000 }).toContain(cover.email);
    expectStatus(await bank.adminApi.put(`/users/${cover.user.userId}`, { roleIds: ['support_agent', 'senior_reviewer'], expires: { senior_reviewer: '2000-01-01T00:00:00Z' } }), 400);
  });
});

test.describe('STAFF-08 Platform staff restore access to a locked-out institution', { tag: ['@staff', '@STAFF-08'] }, () => {
  test('with a verified ticket, staff invite a new administrator; both audit logs and the administrators know', async () => {
    const staff = Api.as(await staffSession());
    const email = uniqueEmail('restored-admin', `${bank.key}.example`);
    expectStatus(await staff.post(`/platform/tenants/${bank.key}/recover-access`, { email, reason: 'short' , ticket: 'T-1' }), 400);
    expectStatus(await staff.post(`/platform/tenants/${bank.key}/recover-access`, { email, reason: 'The only administrator left the bank' }), 400);
    expectForbidden(await bank.adminApi.post(`/platform/tenants/${bank.key}/recover-access`, { email, reason: 'The only administrator left the bank', ticket: 'SUP-1234' }));

    const since = Date.now() - 1000;
    const restored = await staff.post(`/platform/tenants/${bank.key}/recover-access`, { email, name: 'Restored Admin', reason: 'The only administrator left the bank', ticket: 'SUP-1234' });
    expectStatus(restored, 201);
    expect(restored.body).toMatchObject({ email, role: 'admin', ticket: 'SUP-1234' });
    const notice = await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: /Platform support restored an administrator/, since });
    expect(notice.text).toContain('SUP-1234');
    const admin = await acceptInvitation({ tenant: bank.key, email, since });
    expect(admin.user.userTenants[0].roleNames).toEqual(['admin']);
    const tenantAudit = JSON.stringify((await Api.as(admin).get('/audit?action=access.recovered')).body);
    expect(tenantAudit).toContain('SUP-1234');
    const platformAudit = JSON.stringify((await staff.get('/platform/audit?action=tenant.access_recovered')).body);
    expect(platformAudit).toContain(email);
  });
});
