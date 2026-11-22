import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus, type Session } from '../../support/api';
import { DEFAULT_PASSWORD, deleteTenant, uniqueEmail } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { appClient, clientSessionFor, idpClient, idpIdToken, installBankingApp, systemApi } from '../../support/client-app';
import { env } from '../../support/env';

test.describe.configure({ timeout: 120_000 });

let inst: Institution;
let designer: Api;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', integrations: 'integration_manager' } });
  designer = Api.as(inst.members.designer);
  await installBankingApp(designer);
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

/** Wait for the welcome workflow (`client.registered`) to have run for this client. */
async function welcomed(client: Api) {
  await expect.poll(async () => {
    const data = (await client.post('/me/app/data', { sources: ['me', 'notifications'] })).body;
    return { segments: data.me.segments, notes: data.notifications.map((n: any) => n.title) };
  }, { timeout: 30_000 }).toEqual({ segments: expect.arrayContaining(['registered']), notes: expect.arrayContaining(['Welcome aboard']) });
}

test.describe('APP-06 Sign up on the app: profile fields, consents, welcome workflow', { tag: ['@client', '@APP-06', '@CLI-01'] }, () => {
  test('the sign-up form follows the app; required consents are enforced and recorded', async () => {
    const form = await Api.anonymous(inst.bank.key).get('/auth/client/registration');
    expectStatus(form, 200);
    expect(form.body).toMatchObject({ available: true, enabled: true, fields: [expect.objectContaining({ key: 'phone', label: 'Mobile number' })] });
    expect(form.body.consents.map((c: any) => c.key)).toEqual(['terms', 'privacy']);

    const email = uniqueEmail('signup', 'customers.example');
    const refused = await Api.anonymous(inst.bank.key).post('/auth/register', { email, password: DEFAULT_PASSWORD, name: 'Sid Signup', consents: [{ key: 'terms', version: '2026-01' }] });
    expectStatus(refused, 400);
    expect(refused.body.error).toContain('Privacy notice');

    const created = await Api.anonymous(inst.bank.key).post<Session>('/auth/register', {
      email, password: DEFAULT_PASSWORD, name: 'Sid Signup',
      profile: { phone: '+44 7700 900222', kycLevel: 9 },
      consents: [{ key: 'terms', version: '2026-01' }, { key: 'privacy', version: '2026-01' }, { key: 'privacy', version: 'old' }],
    });
    expectStatus(created, 201);
    const me = Api.as(created.body);
    await welcomed(me);
    const data = (await me.post('/me/app/data', { sources: ['me'] })).body.me;
    expect(data.phone).toBe('+44 7700 900222');
    expect(data.kycLevel).toBeUndefined(); // only the fields sign-up asks for
    expect(data.consents.map((c: any) => `${c.key}@${c.version}`)).toEqual(['terms@2026-01', 'privacy@2026-01']);
  });

  test('when the app closes sign-up, accounts are by invitation only', async () => {
    const draft = (await designer.get('/client-apps/current')).body.draft;
    draft.registration.enabled = false;
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    expectStatus(await designer.post('/client-apps/current/publish'), 200);
    const refused = await Api.anonymous(inst.bank.key).post('/auth/register', { email: uniqueEmail('late'), password: DEFAULT_PASSWORD, consents: [{ key: 'terms', version: '2026-01' }, { key: 'privacy', version: '2026-01' }] });
    expectForbidden(refused);
    draft.registration.enabled = true;
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    expectStatus(await designer.post('/client-apps/current/publish'), 200);
  });
});

test.describe('APP-07 The institution\'s systems register clients, open their sessions and push their data', { tag: ['@integration-manager', '@APP-07'] }, () => {
  test('a client session for an external customer: single-use secret, mapping, client.registered', async () => {
    const externalId = `EXT-${Date.now()}`;
    const email = uniqueEmail('ext', 'customers.example');
    const first = await clientSessionFor(inst.bank, system, { externalId, email, name: 'Erin External', attributes: { customerNumber: externalId, tier: 'gold' } });
    expect(first.created).toBe(true);
    expect(first.clientSecret).toMatch(/^cs_/);
    expect(first.session.user).toMatchObject({ kind: 'client', email });
    // The secret works once.
    expectForbidden(await Api.anonymous(inst.bank.key).post('/auth/client/session', { clientSecret: first.clientSecret }));

    const me = Api.as(first.session);
    await welcomed(me);
    const profile = (await me.post('/me/app/data', { sources: ['me'] })).body.me;
    expect(profile).toMatchObject({ externalId, tier: 'gold', customerNumber: externalId, name: 'Erin External' });

    // Clients registered by the bank's systems accept the app's terms in the app; the versions are recorded.
    expectStatus(await me.post('/me/app/consents', { consents: [{ key: 'terms', version: 'outdated' }] }), 400);
    const consented = await me.post('/me/app/consents', { consents: [{ key: 'terms', version: '2026-01' }, { key: 'privacy', version: '2026-01' }] });
    expectStatus(consented, [200, 201]);
    expect(consented.body.consents.map((c: any) => `${c.key}@${c.version}`)).toEqual(['terms@2026-01', 'privacy@2026-01']);

    // The same customer again: the same client, no duplicate, no second welcome.
    const again = await clientSessionFor(inst.bank, system, { externalId, email, name: 'Erin External' });
    expect(again).toMatchObject({ created: false, clientId: first.clientId });
    const clients = (await inst.bank.adminApi.get(`/clients?search=${encodeURIComponent(email)}`)).body;
    expect(clients).toHaveLength(1);
  });

  test('an existing client with the same e-mail is linked; a secret is only valid for its institution', async () => {
    const existing = await appClient(inst.bank, { name: 'Linda Linked' });
    const linked = await clientSessionFor(inst.bank, system, { externalId: `LNK-${Date.now()}`, email: existing.email, name: 'Linda Linked' });
    expect(linked).toMatchObject({ created: false, clientId: existing.user.userId });

    const other = await prepareInstitution();
    try {
      const secret = (await system.post('/client-sessions', { externalId: `X-${Date.now()}`, email: uniqueEmail('x'), name: 'X' })).body.clientSecret;
      expectForbidden(await Api.anonymous(other.bank.key).post('/auth/client/session', { clientSecret: secret }));
    } finally {
      await deleteTenant(other.bank);
    }
  });

  test('records are written per client (one, many, replace, delete) and only with the right permissions', async () => {
    const externalId = `REC-${Date.now()}`;
    const { session } = await clientSessionFor(inst.bank, system, { externalId, email: uniqueEmail('rec'), name: 'Rita Records' });
    const ref = `ext:${externalId}`;
    expectStatus(await system.put(`/clients/${ref}/records/accounts/acc-1`, { data: { name: 'Main', balance: 10 } }), 200);
    expectStatus(await system.put(`/clients/${ref}/records/accounts/acc-1`, { data: { balance: 25 }, merge: true }), 200);
    expectStatus(await system.put(`/clients/${ref}/records/accounts`, { records: [{ key: 'acc-2', data: { name: 'Second', balance: 1 } }] }), 200);
    let list = (await system.get(`/clients/${ref}/records/accounts`)).body;
    expect(Object.fromEntries(list.map((r: any) => [r.key, [r.name, r.balance]]))).toEqual({ 'acc-1': ['Main', 25], 'acc-2': ['Second', 1] });
    expectStatus(await system.put(`/clients/${ref}/records/accounts`, { records: [{ key: 'acc-3', data: { name: 'Only' } }], replace: true }), 200);
    list = (await system.get(`/clients/${ref}/records/accounts`)).body;
    expect(list.map((r: any) => r.key)).toEqual(['acc-3']);
    expectStatus(await system.delete(`/clients/${ref}/records/accounts/acc-3`), [200, 204]);
    expect((await Api.as(session).post('/me/app/data', { sources: ['records:accounts'] })).body.records.accounts).toEqual([]);

    expectStatus(await system.put(`/clients/${ref}/records/accounts/bad key!`, { data: {} }), 400);
    expectStatus(await system.put('/clients/ext:nobody/records/accounts/a', { data: {} }), 404);
    // Without clients:records / clients:provision.
    const readOnly = await systemApi(inst.bank, ['cases:read']);
    expectForbidden(await readOnly.put(`/clients/${ref}/records/accounts/x`, { data: {} }));
    expectForbidden(await readOnly.post('/client-sessions', { externalId: 'nope', email: uniqueEmail('nope'), name: 'Nope' }));
    // A client cannot write records or open sessions.
    expectForbidden(await Api.as(session).put(`/clients/${ref}/records/accounts/x`, { data: {} }));
  });
});

test.describe('APP-08 Sign in with the institution\'s identity provider (token exchange)', { tag: ['@client', '@APP-08'] }, () => {
  test('an ID token of the trusted issuer becomes a client session; mapping fills the profile', async () => {
    const idp = await idpClient();
    const draft = (await designer.get('/client-apps/current')).body.draft;
    draft.identity = {
      linkByEmail: true,
      mapping: { externalId: 'sub', email: 'email', name: 'name', attributes: { familyName: 'family_name' }, segments: 'groups' },
      tokenExchange: { enabled: true, issuer: env.fakes.oidcIdp, jwksUri: `${env.fakes.oidcIdp}/jwks`, audience: idp.clientId },
    };
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    const published = await designer.post('/client-apps/current/publish');
    expectStatus(published, 200);

    const email = uniqueEmail('idp', 'customers.example');
    const idToken = await idpIdToken(idp, { email, name: 'Ivy Identity', groups: ['premier'] });
    const exchanged = await Api.anonymous(inst.bank.key).post<Session>('/auth/client/token', { subjectToken: idToken });
    expectStatus(exchanged, 200);
    expect(exchanged.body.user).toMatchObject({ kind: 'client', email });
    const me = (await Api.as(exchanged.body).post('/me/app/data', { sources: ['me'] })).body.me;
    expect(me).toMatchObject({ name: 'Ivy Identity', familyName: 'Identity', segments: expect.arrayContaining(['premier']) });
    expect(me.externalId).toHaveLength(24);

    // Tampered, foreign-audience and garbage tokens are refused.
    const [h, p, s] = idToken.split('.');
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), email: 'evil@x.example' })).toString('base64url')}.${s}`;
    for (const subjectToken of [tampered, 'not-a-jwt', await idpIdToken(await idpClient(), { email: uniqueEmail('aud'), name: 'Other Audience' })]) {
      expectStatus(await Api.anonymous(inst.bank.key).post('/auth/client/token', { subjectToken }), [401, 403]);
    }
  });
});
