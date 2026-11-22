import { expect } from '@playwright/test';
import { Api, expectStatus, type Session } from './api';
import { env } from './env';
import { DEFAULT_PASSWORD, uniqueEmail, type TenantHandle } from './factories';

/**
 * Client apps (docs/plans/11): the banking template installed and published by a designer, API clients of the
 * institution's own systems, banking customers with their records, tokens of the institution's identity provider.
 */

export interface InstalledApp {
  version: number;
  /** Journey key → workflow id. */
  journeys: Record<string, string>;
  definition: any;
}

/** The designer loads the banking template (which creates and publishes its journey workflows) and publishes the app. */
export async function installBankingApp(designer: Api): Promise<InstalledApp> {
  expectStatus(await designer.get('/client-apps/current'), 200);
  const installed = await designer.post('/client-apps/current/template', { template: 'banking' });
  expectStatus(installed, 200);
  expect(installed.body.errors).toEqual([]);
  const published = await designer.post('/client-apps/current/publish');
  expectStatus(published, 200);
  const definition = installed.body.draft;
  return {
    version: published.body.activeVersion,
    definition,
    journeys: Object.fromEntries(Object.entries(definition.journeys as Record<string, { workflowId: string }>).map(([k, j]) => [k, j.workflowId])),
  };
}

/** The banking app's terms and privacy notice, as the client accepts them. */
export const BANKING_CONSENTS = [{ key: 'terms', version: '2026-01' }, { key: 'privacy', version: '2026-01' }];

/** A client who signs up on the banking app (accepting its terms and privacy notice). */
export async function appClient(bank: TenantHandle, opts: { name?: string; phone?: string } = {}): Promise<Session & { email: string }> {
  const email = uniqueEmail((opts.name ?? 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'customers.example');
  const res = await Api.anonymous(bank.key).post<Session>('/auth/register', {
    email, password: DEFAULT_PASSWORD, name: opts.name ?? 'App Client', profile: opts.phone ? { phone: opts.phone } : {},
    consents: BANKING_CONSENTS,
  });
  expectStatus(res, 201);
  return { ...res.body, email };
}

/** An API client of the institution's systems with the given permissions, signed in (client credentials). */
export async function systemApi(bank: TenantHandle, permissions: string[], name = 'Core banking'): Promise<Api> {
  const created = await bank.adminApi.post('/api-clients', { name: `${name} ${Date.now()}`, permissions });
  expectStatus(created, 201);
  const token = await Api.anonymous(bank.key).post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: created.body.clientId, client_secret: created.body.clientSecret }));
  expectStatus(token, 200);
  return Api.withToken(token.body.access_token, bank.key);
}

/** A client session for an external customer, through a single-use client secret (what the SDK does). */
export async function clientSessionFor(bank: TenantHandle, system: Api, customer: { externalId: string; email: string; name: string; attributes?: Record<string, unknown> }) {
  const created = await system.post('/client-sessions', customer);
  expectStatus(created, 201);
  const session = await Api.anonymous(bank.key).post<Session>('/auth/client/session', { clientSecret: created.body.clientSecret });
  expectStatus(session, 200);
  return { session: session.body, clientId: created.body.clientId as string, created: created.body.created as boolean, clientSecret: created.body.clientSecret as string };
}

/**
 * An existing customer of the bank: known to its systems, with two accounts and a debit card. They accepted the app's
 * terms already unless `acceptedTerms: false` (the app then asks first).
 */
export async function bankingCustomer(bank: TenantHandle, system: Api, opts: { name?: string; current?: number; savings?: number; acceptedTerms?: boolean } = {}) {
  const externalId = `C-${Math.floor(Math.random() * 1e8)}`;
  const email = uniqueEmail('customer', 'customers.example');
  const { session, clientId } = await clientSessionFor(bank, system, { externalId, email, name: opts.name ?? 'Casey Customer', attributes: { customerNumber: externalId } });
  expectStatus(await system.patch(`/clients/ext:${externalId}/profile`, { addSegments: ['customer'] }), 200);
  expectStatus(await system.put(`/clients/ext:${externalId}/records/accounts`, {
    records: [
      { key: 'cur-1', data: { name: 'Everyday account', type: 'current', number: '•• 1111', balance: opts.current ?? 1500, currency: 'GBP', status: 'active' } },
      { key: 'sav-1', data: { name: 'Rainy day saver', type: 'savings', number: '•• 2222', balance: opts.savings ?? 500, currency: 'GBP', rate: 3.1, status: 'active' } },
    ],
  }), 200);
  expectStatus(await system.put(`/clients/ext:${externalId}/records/cards/card-1`, { data: { name: 'Debit card', type: 'debit', network: 'visa', last4: '4242', status: 'active', expiry: '09/29', holder: opts.name ?? 'Casey Customer' } }), 200);
  expectStatus(await system.put(`/clients/ext:${externalId}/records/transactions/tx-1`, { data: { account: 'cur-1', date: new Date().toISOString(), description: 'Coffee House', amount: -3.2, currency: 'GBP', category: 'Dining out' } }), 200);
  if (opts.acceptedTerms !== false) expectStatus(await Api.as(session).post('/me/app/consents', { consents: BANKING_CONSENTS }), [200, 201]);
  return { session, clientId, externalId, email };
}

/** Poll a journey until `predicate` holds. */
export async function waitForJourney(client: Api, caseId: string, predicate: (state: any) => boolean, timeoutMs = 20_000) {
  let last: any;
  await expect.poll(async () => {
    const res = await client.get(`/me/app/cases/${caseId}/journey`);
    expectStatus(res, 200);
    last = res.body;
    return predicate(last);
  }, { timeout: timeoutMs, message: `journey ${caseId}` }).toBe(true);
  return last;
}

/**
 * Start a journey as the client; the answer usually carries the first screen already, and when the engine is slower
 * than the API's short wait, the journey is polled until it stops "working".
 */
export async function startJourney(client: Api, journey: string, input: Record<string, unknown> = {}) {
  const res = await client.post(`/me/app/journeys/${journey}/start`, { input });
  expectStatus(res, [200, 201]);
  return res.body.state === 'working' ? waitForJourney(client, res.body.case.id, (s) => s.state !== 'working') : res.body;
}

/** Press a button of the journey's current screen. */
export async function submitScreen(client: Api, state: any, event: string, values: Record<string, unknown> = {}) {
  return client.post(`/me/app/cases/${state.case.id}/screens/${state.screen.taskId}`, { event, values });
}

export interface IdpClient { clientId: string; clientSecret: string; redirectUri: string }

/** The institution's web site registered at its identity provider (fake OIDC IdP). */
export async function idpClient(): Promise<IdpClient> {
  const redirectUri = 'https://www.bank.example/callback';
  const response = await fetch(`${env.fakes.oidcIdp}/__control/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirectUris: [redirectUri] }) });
  return { ...(await response.json() as { clientId: string; clientSecret: string }), redirectUri };
}

/** An ID token for `person` from the identity provider, through the authorization code flow (as the site signs them in). */
export async function idpIdToken(client: IdpClient, person: { email: string; name: string; groups?: string[] }) {
  await fetch(`${env.fakes.oidcIdp}/__control/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...person, password: 'idp-password-123' }) });
  const login = await fetch(`${env.fakes.oidcIdp}/authorize/login`, {
    method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.clientId, redirect_uri: client.redirectUri, response_type: 'code', scope: 'openid email profile groups', login: person.email, password: 'idp-password-123' }),
  });
  const code = new URL(login.headers.get('location')!).searchParams.get('code')!;
  const token = await (await fetch(`${env.fakes.oidcIdp}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: client.redirectUri, client_id: client.clientId, client_secret: client.clientSecret }),
  })).json() as { id_token: string };
  return token.id_token;
}
