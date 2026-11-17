import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { createTenant, deleteTenant, login, type TenantHandle } from '../../support/factories';
import { idpUser, setUpSso, ssoSignInWithoutBrowser } from '../../support/sso';
import { addMember } from '../../support/factories';

/**
 * FIA-06: institutions bring their workforce IdP through the SSO broker (WorkOS; locally its emulator) and the fake
 * OIDC IdP. FIA-07: the IdP provisions members by SCIM into the broker's directory; Fintivio applies the broker's
 * directory events (create, update, deactivate with sessions revoked).
 */
let bank: TenantHandle;
let ssoDomain: string;
test.beforeAll(async () => {
  bank = await createTenant();
  ssoDomain = `${bank.key}.corp.example`;
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe.configure({ mode: 'serial' });

test.describe('FIA-06 Configure SSO with enforcement and just-in-time provisioning', { tag: ['@fi-admin', '@FIA-06'] }, () => {
  test('enforcement needs an active connection and a verified domain', async () => {
    expectStatus(await bank.adminApi.put('/sso/settings', { enforce: true }), 409);
    await setUpSso(bank, { domain: ssoDomain, verify: false, connect: false });
    expectStatus(await bank.adminApi.put('/sso/settings', { enforce: true }), 409);
    const status = await bank.adminApi.get('/sso');
    expect(status.body).toMatchObject({ configured: true, ready: false, domains: [expect.objectContaining({ domain: ssoDomain, state: 'pending' })] });
  });

  test('the IT team connects the IdP and verifies the domain in the Admin Portal; secrets never reach Fintivio', async () => {
    const { client } = await setUpSso(bank, { domain: ssoDomain });
    const status = await bank.adminApi.get('/sso');
    expectStatus(status, 200);
    expect(status.body).toMatchObject({ ready: true, connections: [expect.objectContaining({ state: 'active', type: 'GenericOIDC' })] });
    expect(status.body.domains).toEqual([expect.objectContaining({ domain: ssoDomain, state: 'verified' })]);
    expect(JSON.stringify(status.body)).not.toContain(client!.clientSecret);
  });

  test('home realm discovery sends addresses of the verified domain to the IdP', async () => {
    const sso = await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent(`jane@${ssoDomain}`)}`);
    expect(sso.body).toMatchObject({ sso: true });
    expect(sso.body.redirectUrl).toContain('/auth/sso/start');
    const other = await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent('jane@gmail.example')}`);
    expect(other.body).toMatchObject({ sso: false });
  });

  test('without just-in-time provisioning, unknown people are refused; with it, they join with the default role', async () => {
    const email = `new.joiner@${ssoDomain}`;
    await idpUser(email, { name: 'New Joiner' });
    const discover = await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent(email)}`);
    const refused = await ssoSignInWithoutBrowser(discover.body.redirectUrl, email);
    expect(refused.searchParams.get('sso_error')).toMatch(/ask an administrator/);

    expectStatus(await bank.adminApi.put('/sso/settings', { jit: { enabled: true, defaultRoles: ['reviewer'] } }), 200);
    const back = await ssoSignInWithoutBrowser((await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent(email)}`)).body.redirectUrl, email);
    const handoff = back.searchParams.get('sso');
    expect(handoff).toBeTruthy();
    const session = await Api.anonymous(bank.key).post('/auth/sso/exchange', { code: handoff });
    expectStatus(session, 200);
    expect(session.body.user).toMatchObject({ email, userTenants: [expect.objectContaining({ roleNames: ['reviewer'] })] });
    // The hand-off code works once.
    expectStatus(await Api.anonymous(bank.key).post('/auth/sso/exchange', { code: handoff }), 400);
    const audit = await bank.adminApi.get('/audit?action=member.jit_provisioned');
    expect(JSON.stringify(audit.body)).toContain(email);
  });

  test('with enforcement, password sign-in is refused for the SSO domain', async () => {
    expectStatus(await bank.adminApi.put('/sso/settings', { enforce: true }), 200);
    const res = await login(bank.key, `someone@${ssoDomain}`, 'whatever-password');
    expectStatus(res, 403);
    expect(res.body.error).toBe('sso_required');
    // Other addresses still use passwords (e.g. external consultants).
    expectStatus(await login(bank.key, 'nobody@elsewhere.example', 'whatever-password'), 401);
  });

  test('only security:manage holders configure single sign-on', async () => {
    const reviewer = await bank.adminApi.get('/sso');
    expectStatus(reviewer, 200);
    const member = (await bank.adminApi.get('/users')).body as any[];
    expect(member.length).toBeGreaterThan(0);
    expectStatus(await Api.anonymous(bank.key).post('/sso/setup-link', { intent: 'sso' }), 401);
  });
});

test.describe('FIA-07 Provision members from the IdP (SCIM through the broker)', { tag: ['@fi-admin', '@FIA-07'] }, () => {
  test('the IdP creates, updates and deactivates members; deactivation ends their sessions', async () => {
    // The IT team sets up a directory in the Admin Portal and gives its SCIM URL and token to the IdP.
    const link = (await bank.adminApi.post('/sso/setup-link', { intent: 'dsync' })).body.link as string;
    const portal = await (await fetch(`${link}/directory`, { method: 'POST' })).text();
    const [, endpoint] = portal.match(/SCIM base URL <code>([^<]+)<\/code>/)!;
    const [, token] = portal.match(/bearer token <code>([^<]+)<\/code>/)!;
    const scim = (path: string, method: string, body?: unknown) => fetch(`${endpoint}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/scim+json' }, body: body ? JSON.stringify(body) : undefined,
    });

    const userName = `scim.user.${Date.now()}@${ssoDomain}`;
    const created = await scim('/Users', 'POST', {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName, name: { givenName: 'Scim', familyName: 'User' },
      emails: [{ value: userName, primary: true }], active: true,
    });
    expect(created.status).toBe(201);
    const scimId = (await created.json()).id as string;
    const member = async () => ((await bank.adminApi.get('/users')).body as any[]).find((m) => m.email === userName);
    await expect.poll(async () => (await member())?.status, { timeout: 20_000 }).toBe('active');
    expect(JSON.stringify(await member())).toContain('reviewer');

    const deactivated = await scim(`/Users/${scimId}`, 'PATCH', { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', value: { active: false } }] });
    expect(deactivated.status).toBe(200);
    await expect.poll(async () => (await member())?.status, { timeout: 20_000 }).toMatch(/disabled|inactive/);
    const audit = await bank.adminApi.get('/audit?action=member.deprovisioned');
    expect(JSON.stringify(audit.body)).toContain(userName);
  });

  test('a deprovisioned member who was signed in loses their session', async () => {
    const link = (await bank.adminApi.post('/sso/setup-link', { intent: 'dsync' })).body.link as string;
    const portal = await (await fetch(`${link}/directory`, { method: 'POST' })).text();
    const [, endpoint] = [...portal.matchAll(/SCIM base URL <code>([^<]+)<\/code>/g)].at(-1)!;
    const [, token] = [...portal.matchAll(/bearer token <code>([^<]+)<\/code>/g)].at(-1)!;
    // A member invited by hand, later pushed by the directory as inactive (e.g. left the company).
    const signedIn = await addMember(bank, { roles: ['reviewer'], label: 'leaver' });
    expectStatus(await Api.as(signedIn).get('/auth/me'), 200);
    const pushed = await fetch(`${endpoint}/Users`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/scim+json' },
      body: JSON.stringify({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: signedIn.email, emails: [{ value: signedIn.email, primary: true }], active: false }),
    });
    expect(pushed.status).toBe(201);
    await expect.poll(async () => (await Api.as(signedIn).get('/auth/me')).status, { timeout: 20_000 }).toBe(401);
  });
});
