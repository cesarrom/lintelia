import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, staffSession, type TenantHandle } from '../../support/factories';
import { idpUser, setUpSso, ssoSignInWithoutBrowser } from '../../support/sso';
import { waitForEmail } from '../../support/mailbox';
import type { Session } from '../../support/api';

/**
 * FIA-16: as soon as single sign-on is linked (a verified SSO domain), roles of people of that domain come from the
 * identity provider's groups — no switch, no exception (docs/plans/15 §5.4, §13). Single sign-on being optional,
 * institutions without it manage roles in the app. The IdP says who is in which group (SSO sign-ins, SCIM directory
 * groups); the institution maps groups to roles; the app decides what a role may do. Local accounts outside the SSO
 * domains keep roles assigned by hand; guards keep the institution administered.
 */
let bank: TenantHandle;
let domain: string;
let early: Awaited<ReturnType<typeof addMember>>;

test.beforeAll(async () => {
  bank = await createTenant();
  domain = `${bank.key}.corp.example`;
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe.configure({ mode: 'serial' });

async function ssoSession(email: string, groups: string[]): Promise<Session> {
  await idpUser(email, { groups, name: email.split('@')[0] });
  const discover = await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent(email)}`);
  const back = await ssoSignInWithoutBrowser(discover.body.redirectUrl, email);
  const session = await Api.anonymous(bank.key).post('/auth/sso/exchange', { code: back.searchParams.get('sso') });
  expectStatus(session, 200);
  return session.body;
}
const rolesOf = (session: Session) => session.user.userTenants[0]?.roleNames ?? [];
const member = async (email: string) => ((await bank.adminApi.get('/users')).body as Array<{ id: string; email: string; roles: string[]; managedByIdp: boolean; idpPending: boolean }>).find((m) => m.email === email)!;

test.describe('FIA-16 Roles come from the identity provider once single sign-on is linked', { tag: ['@fi-admin', '@FIA-16'] }, () => {
  let admin: Session;
  let analystEmail: string;

  test('without single sign-on, roles are managed in the app; linking it makes the IdP decide, and the administrators are told', async () => {
    early = await addMember(bank, { roles: ['reviewer', 'auditor'], label: 'early' });
    // An address of the future SSO domain, given roles by hand while single sign-on is not linked.
    const preexisting = `early.bird@${domain}`;
    expectStatus(await bank.adminApi.post('/users', { email: preexisting, name: 'Early Bird', roleIds: ['reviewer', 'auditor'] }), 200);
    expect((await bank.adminApi.get('/sso')).body).toMatchObject({ configured: false, rolesFromIdp: false });

    const since = Date.now() - 1000;
    await setUpSso(bank, { domain });
    const status = (await bank.adminApi.get('/sso')).body;
    expect(status).toMatchObject({ ready: true, rolesFromIdp: true });
    await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: new RegExp(`Roles of ${domain.replace(/\./g, '\\.')} now come from your identity provider`), since });

    // Nobody loses their roles before the IdP told us about them; but by hand, nothing changes for that domain any more.
    const before = await member(preexisting);
    expect(before).toMatchObject({ managedByIdp: true, idpPending: true });
    expect(before.roles.sort()).toEqual(['auditor', 'reviewer']);
    const refused = await bank.adminApi.put(`/users/${before.id}`, { roleIds: ['admin'] });
    expectStatus(refused, 409);
    expect(refused.body.error).toContain('come from your identity provider');
    // People of other domains (the local administrator, consultants) keep roles assigned in the app.
    expect(await member(early.email)).toMatchObject({ managedByIdp: false });
    expectStatus(await bank.adminApi.put(`/users/${early.user.userId}`, { roleIds: ['reviewer'] }), 200);
  });

  test('the mappings say which role each group gives; a preview shows the outcome and warns about what is missing', async () => {
    expectStatus(await bank.adminApi.put('/sso/settings', { jit: { enabled: true, defaultRoles: [] } }), 200);
    expectStatus(await bank.adminApi.put('/sso/role-mappings', { mappings: [{ group: 'KYC-Analysts', role: 'reviewer' }] }), 200);
    const partial = (await bank.adminApi.get('/sso/role-mappings')).body;
    expect(partial).toMatchObject({ linked: true, domains: [domain] });
    expect(partial.warnings.join(' ')).toContain('No group is mapped to the Administrator role');

    const mappings = [{ group: 'KYC-Analysts', role: 'reviewer' }, { group: 'Fintivio-Admins', role: 'admin' }, { group: 'Team-Leads', role: 'senior_reviewer' }];
    const preview = (await bank.adminApi.post('/sso/role-mappings/preview', { mappings })).body;
    expect(preview.administrators).toContain(bank.adminEmail);
    expectStatus(await bank.adminApi.put('/sso/role-mappings', { mappings }), 200);
    expect((await bank.adminApi.get('/sso/role-mappings')).body.mappings).toEqual(expect.arrayContaining([{ group: 'Fintivio-Admins', role: 'admin' }]));
  });

  test('the first SSO sign-in replaces hand-given roles by the groups’ roles, and every sign-in follows the groups', async () => {
    const early = await ssoSession(`early.bird@${domain}`, ['Team-Leads']);
    expect(rolesOf(early)).toEqual(['senior_reviewer']);
    expect(await member(`early.bird@${domain}`)).toMatchObject({ idpPending: false });

    analystEmail = `analyst@${domain}`;
    expect(rolesOf(await ssoSession(analystEmail, ['KYC-Analysts', 'Everyone']))).toEqual(['reviewer']);
    expect(rolesOf(await ssoSession(analystEmail, ['KYC-Analysts', 'Team-Leads'])).sort()).toEqual(['reviewer', 'senior_reviewer']);
    expect(rolesOf(await ssoSession(analystEmail, ['Everyone']))).toEqual([]);
    expect(JSON.stringify((await bank.adminApi.get('/audit?action=member.roles_synced')).body)).toContain(analystEmail);
  });

  test('administrative roles given by the IdP are told to the administrators', async () => {
    const since = Date.now() - 1000;
    admin = await ssoSession(`it.admin@${domain}`, ['Fintivio-Admins']);
    expect(rolesOf(admin)).toEqual(['admin']);
    await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: /Administrative roles changed by your identity provider/, since });
  });

  test('invitations of the SSO domain carry no roles; other domains still do', async () => {
    expectStatus(await bank.adminApi.post('/users', { email: `someone@${domain}`, roleIds: ['reviewer'] }), 409);
    expectStatus(await bank.adminApi.post('/users', { email: `someone@${domain}`, roleIds: [] }), 200);
    const consultant = await addMember(bank, { roles: ['auditor'], label: 'consultant' });
    expect(consultant.user.userTenants[0].roleNames).toEqual(['auditor']);
  });

  test('directory groups (SCIM) give and take roles too', async () => {
    const link = (await bank.adminApi.post('/sso/setup-link', { intent: 'dsync' })).body.link as string;
    const portal = await (await fetch(`${link}/directory`, { method: 'POST' })).text();
    const [, endpoint] = [...portal.matchAll(/SCIM base URL <code>([^<]+)<\/code>/g)].at(-1)!;
    const [, token] = [...portal.matchAll(/bearer token <code>([^<]+)<\/code>/g)].at(-1)!;
    const scim = async (path: string, method: string, body?: unknown) => fetch(`${endpoint}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/scim+json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const email = `joiner.${Date.now()}@${domain}`;
    const user = await (await scim('/Users', 'POST', { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: email, emails: [{ value: email, primary: true }], active: true })).json();
    const rolesNow = async () => (await member(email))?.roles;
    await expect.poll(rolesNow, { timeout: 20_000 }).toEqual([]);

    const group = await (await scim('/Groups', 'POST', { schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'], displayName: 'KYC-Analysts', members: [{ value: user.id }] })).json();
    await expect.poll(rolesNow, { timeout: 20_000 }).toEqual(['reviewer']);
    const removed = await scim(`/Groups/${group.id}`, 'PATCH', { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'remove', path: `members[value eq "${user.id}"]` }] });
    expect(removed.status).toBe(200);
    await expect.poll(rolesNow, { timeout: 20_000 }).toEqual([]);
  });

  test('guards: the Administrator role is kept while no group maps to it, and for the last administrator', async () => {
    const itAdmin = Api.as(admin);
    // With the local administrator gone, the IdP's administrator is the only one.
    expectStatus(await itAdmin.patch(`/users/${bank.admin.user.userId}/deactivate`), 200);

    // No group mapped to Administrator: the administrators keep that role whatever their groups.
    expectStatus(await itAdmin.put('/sso/role-mappings', { mappings: [{ group: 'KYC-Analysts', role: 'reviewer' }] }), 200);
    let since = Date.now() - 1000;
    expect(rolesOf(await ssoSession(`it.admin@${domain}`, ['KYC-Analysts'])).sort()).toEqual(['admin', 'reviewer']);
    await waitForEmail({ tenant: bank.key, to: `it.admin@${domain}`, subject: /Kept the administrator role/, since });

    // A group mapped to Administrator, but they left it and nobody else administers: kept too.
    expectStatus(await itAdmin.put('/sso/role-mappings', { mappings: [{ group: 'KYC-Analysts', role: 'reviewer' }, { group: 'Fintivio-Admins', role: 'admin' }] }), 200);
    since = Date.now() - 1000;
    const kept = await ssoSession(`it.admin@${domain}`, ['Everyone']);
    expect(rolesOf(kept)).toEqual(['admin']);
    await waitForEmail({ tenant: bank.key, to: `it.admin@${domain}`, subject: /Kept the administrator role/, since });
    const audit = JSON.stringify((await Api.as(kept).get('/audit?action=member.role_sync_blocked')).body);
    expect(audit).toContain('last active administrator');
    expect(audit).toContain('no group maps to the Administrator role yet');
    // Staff can still offboard the institution (the suite's clean-up), whatever happened to its administrators.
    expect((await staffSession()).user.kind).toBe('staff');
  });
});
