import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createFakeService, devPort, escapeHtml, jsonState, page } from '@repo/fake-kit';

/**
 * WorkOS emulator (docs/plans/02 §Local alternative): the subset of the WorkOS API the core's WorkOS adapter calls,
 * with the same shapes, so `@workos-inc/node` runs unchanged against it (`apiHostname: localhost, https: false,
 * port: 9300`). Protocol handling is real: OIDC connections do the authorization code flow with the IdP (locally
 * fake-services/idp-oidc) and verify its ID tokens.
 *
 *   POST/GET/DELETE /organizations[/{id}]          organizations with their domains
 *   GET  /connections?organization_id=             SSO connections (GenericOIDC)
 *   POST /portal/generate_link                     Admin Portal link → `/portal/{token}` (configure OIDC, verify domains)
 *   GET  /sso/authorize                            → the organization's IdP → back with a code
 *   POST /sso/token                                code → `{ access_token, profile }`
 *
 * Domain verification uses DNS TXT records; locally the "DNS" is `/__control/dns` (tests and the portal page set it).
 * Control API: `/__control/organizations`, `/__control/dns`, `/__control/connections` (create without the portal).
 */
interface Domain { object: 'organization_domain'; id: string; domain: string; organization_id: string; state: 'pending' | 'verified'; verification_strategy: 'dns'; verification_token: string; verification_prefix: string; created_at: string; updated_at: string }
interface Organization { object: 'organization'; id: string; name: string; external_id: string | null; metadata: Record<string, string>; allow_profiles_outside_organization: boolean; domains: Domain[]; created_at: string; updated_at: string }
interface Connection { object: 'connection'; id: string; organization_id: string; connection_type: 'GenericOIDC'; name: string; state: 'active' | 'inactive'; oidc: { issuer: string; clientId: string; clientSecret: string }; created_at: string; updated_at: string }
interface AuthRequest { clientId: string; redirectUri: string; state: string | null; connectionId: string; codeVerifier: string; expiresAt: number }
interface Profile { id: string; idp_id: string; organization_id: string; connection_id: string; connection_type: string; email: string; first_name: string | null; last_name: string | null; name: string | null; groups: string[]; raw_attributes: Record<string, unknown> }

const port = devPort('workos', 9300);
const base = process.env.WORKOS_FAKE_PUBLIC_URL ?? `http://localhost:${port}`;
const service = createFakeService({ name: 'workos', port, recordPaths: (p) => !p.startsWith('/portal') && !p.startsWith('/__') });
interface Directory { object: 'directory'; id: string; organization_id: string; name: string; type: 'generic scim v2.0'; state: 'linked'; token: string; created_at: string }
interface DirectoryUser { object: 'directory_user'; id: string; directory_id: string; organization_id: string; idp_id: string; email: string; first_name: string | null; last_name: string | null; state: 'active' | 'inactive'; raw_attributes: Record<string, unknown>; custom_attributes: Record<string, unknown>; groups: unknown[]; created_at: string; updated_at: string }
interface WorkOsEvent { object: 'event'; id: string; event: string; data: Record<string, unknown>; created_at: string; organization_id: string }

const store = jsonState<{ organizations: Organization[]; connections: Connection[]; portals: Record<string, { organizationId: string; intent: string; returnUrl: string | null; expiresAt: number }>; dns: Record<string, string[]>; directories: Directory[]; users: DirectoryUser[]; events: WorkOsEvent[] }>(
  'workos', 'state.json', { organizations: [], connections: [], portals: {}, dns: {}, directories: [], users: [], events: [] },
);
const authRequests = new Map<string, AuthRequest>();
const codes = new Map<string, { profile: Profile; clientId: string; expiresAt: number }>();
service.onReset(() => { store.set({ organizations: [], connections: [], portals: {}, dns: {}, directories: [], users: [], events: [] }); authRequests.clear(); codes.clear(); });

const id = (prefix: string) => `${prefix}_${randomBytes(13).toString('hex').toUpperCase()}`;
const now = () => new Date().toISOString();
const save = (change: Partial<ReturnType<typeof store.get>>) => store.set({ ...store.get(), ...change });
const org = (orgId: string) => store.get().organizations.find((o) => o.id === orgId);
const apiError = (message: string, status: number, code = 'invalid_request') => new Response(JSON.stringify({ message, code }), { status, headers: { 'Content-Type': 'application/json' } });
const authorised = (header: string | undefined) => /^Bearer\s+sk_\S+/.test(header ?? '');
const list = <T>(data: T[]) => ({ object: 'list', data, list_metadata: { before: null, after: null } });

const app = service.app;
app.use('/organizations/*', async (c, next) => (authorised(c.req.header('authorization')) ? next() : apiError('Unauthorized', 401, 'unauthorized')));
app.use('/organizations', async (c, next) => (authorised(c.req.header('authorization')) ? next() : apiError('Unauthorized', 401, 'unauthorized')));
app.use('/connections', async (c, next) => (authorised(c.req.header('authorization')) ? next() : apiError('Unauthorized', 401, 'unauthorized')));
app.use('/portal/generate_link', async (c, next) => (authorised(c.req.header('authorization')) ? next() : apiError('Unauthorized', 401, 'unauthorized')));

// --- organizations -----------------------------------------------------------------------------------------------------

app.post('/organizations', async (c) => {
  const body = await c.req.json<{ name: string; external_id?: string; metadata?: Record<string, string>; domain_data?: Array<{ domain: string; state?: 'pending' | 'verified' }> }>();
  if (!body.name) return apiError('name is required', 422);
  const orgId = id('org');
  const created: Organization = {
    object: 'organization', id: orgId, name: body.name, external_id: body.external_id ?? null, metadata: body.metadata ?? {}, allow_profiles_outside_organization: false,
    domains: (body.domain_data ?? []).map((d) => newDomain(orgId, d.domain, d.state ?? 'pending')), created_at: now(), updated_at: now(),
  };
  save({ organizations: [...store.get().organizations, created] });
  return c.json(created, 201);
});
app.get('/organizations/:id', (c) => {
  const found = org(c.req.param('id'));
  return found ? c.json(found) : apiError('Organization not found', 404, 'entity_not_found');
});
app.delete('/organizations/:id', (c) => {
  const orgId = c.req.param('id');
  save({ organizations: store.get().organizations.filter((o) => o.id !== orgId), connections: store.get().connections.filter((x) => x.organization_id !== orgId) });
  return c.body(null, 202);
});

function newDomain(organizationId: string, domain: string, state: 'pending' | 'verified'): Domain {
  return {
    object: 'organization_domain', id: id('org_domain'), domain: domain.toLowerCase(), organization_id: organizationId, state, verification_strategy: 'dns',
    verification_token: randomBytes(8).toString('hex'), verification_prefix: 'workos-domain-verification', created_at: now(), updated_at: now(),
  };
}

const publicConnection = ({ oidc: _oidc, ...connection }: Connection) => ({ ...connection, domains: org(connection.organization_id)?.domains.map((d) => ({ object: 'connection_domain', id: d.id, domain: d.domain })) ?? [] });

app.get('/connections', (c) => {
  const organizationId = c.req.query('organization_id');
  return c.json(list(store.get().connections.filter((x) => !organizationId || x.organization_id === organizationId).map(publicConnection)));
});

// --- Admin Portal ------------------------------------------------------------------------------------------------------

app.post('/portal/generate_link', async (c) => {
  const body = await c.req.json<{ intent: string; organization: string; return_url?: string }>();
  if (!org(body.organization)) return apiError('Organization not found', 404, 'entity_not_found');
  if (!['sso', 'domain_verification', 'dsync', 'audit_logs'].includes(body.intent)) return apiError('Invalid intent', 422);
  const token = randomBytes(16).toString('hex');
  save({ portals: { ...store.get().portals, [token]: { organizationId: body.organization, intent: body.intent, returnUrl: body.return_url ?? null, expiresAt: Date.now() + 5 * 60_000 } } });
  return c.json({ link: `${base}/portal/${token}` }, 201);
});

const portalOf = (token: string) => {
  const entry = store.get().portals[token];
  return entry && entry.expiresAt > Date.now() ? { ...entry, organization: org(entry.organizationId)! } : null;
};

function portalPage(token: string, message?: string, error?: string) {
  const portal = portalOf(token)!;
  const o = portal.organization;
  const connections = store.get().connections.filter((x) => x.organization_id === o.id);
  const records = (domain: Domain) => `${domain.verification_prefix}.${domain.domain} TXT "${domain.verification_token}"`;
  return page(`WorkOS Admin Portal · ${o.name}`, `
${message ? `<p class="card" style="color:#166534" data-testid="portal-message">${escapeHtml(message)}</p>` : ''}
${error ? `<p class="card" style="color:#b91c1c" role="alert">${escapeHtml(error)}</p>` : ''}
<div class="card"><h3>Domains</h3>
<table>${o.domains.map((d) => `<tr data-testid="portal-domain" data-state="${d.state}"><td>${escapeHtml(d.domain)}</td><td>${d.state}</td><td class="muted">${d.state === 'pending' ? `Add the DNS record <code>${escapeHtml(records(d))}</code>` : ''}</td>
<td>${d.state === 'pending' ? `<form method="post" action="/portal/${token}/domains/${d.id}/verify"><button>Verify</button></form>` : ''}</td></tr>`).join('')}</table>
<form method="post" action="/portal/${token}/domains"><input name="domain" placeholder="bank.com" aria-label="Domain"> <button>Add domain</button></form></div>
<div class="card"><h3>Single sign-on (OpenID Connect)</h3>
${connections.map((x) => `<p data-testid="portal-connection" data-state="${x.state}">${escapeHtml(x.name)} · ${x.state} · issuer ${escapeHtml(x.oidc.issuer)}</p>`).join('')}
<p class="muted">Redirect URI to register in your identity provider: <code>${escapeHtml(`${base}/sso/oidc/callback`)}</code></p>
<form method="post" action="/portal/${token}/oidc">
<p><label>Issuer URL<br><input name="issuer" style="width:100%" aria-label="Issuer URL"></label></p>
<p><label>Client ID<br><input name="clientId" style="width:100%" aria-label="Client ID"></label></p>
<p><label>Client secret<br><input name="clientSecret" type="password" style="width:100%" aria-label="Client secret"></label></p>
<button>Save connection</button></form></div>
<div class="card"><h3>Directory sync (SCIM 2.0)</h3>
${(store.get().directories ?? []).filter((d) => d.organization_id === o.id).map((d) => `<p data-testid="portal-directory">SCIM base URL <code>${escapeHtml(`${base}/scim/v2/${d.id}`)}</code> · bearer token <code>${escapeHtml(d.token)}</code></p>`).join('')}
<form method="post" action="/portal/${token}/directory"><button>Set up a directory</button></form></div>
${portal.returnUrl ? `<p><a href="${escapeHtml(portal.returnUrl)}">Back to the application</a></p>` : ''}`, '#6363f1');
}

function createDirectory(organizationId: string) {
  const directory: Directory = { object: 'directory', id: id('directory'), organization_id: organizationId, name: 'SCIM directory', type: 'generic scim v2.0', state: 'linked', token: randomBytes(24).toString('base64url'), created_at: now() };
  save({ directories: [...(store.get().directories ?? []), directory] });
  return directory;
}

app.get('/portal/:token', (c) => (portalOf(c.req.param('token')) ? c.html(portalPage(c.req.param('token'))) : c.html(page('Admin Portal', '<p>This link expired.</p>'), 404)));

app.post('/portal/:token/domains', async (c) => {
  const token = c.req.param('token');
  const portal = portalOf(token);
  if (!portal) return c.html(page('Admin Portal', '<p>This link expired.</p>'), 404);
  const domain = String((await c.req.parseBody()).domain ?? '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return c.html(portalPage(token, undefined, 'Enter a domain name'), 400);
  if (store.get().organizations.some((o) => o.domains.some((d) => d.domain === domain && d.state === 'verified'))) return c.html(portalPage(token, undefined, 'This domain is already verified by another organization'), 409);
  const o = portal.organization;
  if (!o.domains.some((d) => d.domain === domain)) {
    save({ organizations: store.get().organizations.map((x) => (x.id === o.id ? { ...x, domains: [...x.domains, newDomain(o.id, domain, 'pending')], updated_at: now() } : x)) });
  }
  return c.html(portalPage(token, `Domain ${domain} added: create the DNS record, then verify.`));
});

app.post('/portal/:token/domains/:domainId/verify', (c) => {
  const token = c.req.param('token');
  const portal = portalOf(token);
  if (!portal) return c.html(page('Admin Portal', '<p>This link expired.</p>'), 404);
  const domain = portal.organization.domains.find((d) => d.id === c.req.param('domainId'));
  if (!domain) return c.html(portalPage(token, undefined, 'Unknown domain'), 404);
  const txt = store.get().dns[`${domain.verification_prefix}.${domain.domain}`] ?? [];
  if (!txt.includes(domain.verification_token)) return c.html(portalPage(token, undefined, `The TXT record for ${domain.domain} was not found yet`), 422);
  save({ organizations: store.get().organizations.map((x) => (x.id === portal.organization.id ? { ...x, domains: x.domains.map((d) => (d.id === domain.id ? { ...d, state: 'verified' as const, updated_at: now() } : d)), updated_at: now() } : x)) });
  return c.html(portalPage(token, `${domain.domain} is verified.`));
});

async function discover(issuer: string) {
  const response = await fetch(new URL('/.well-known/openid-configuration', issuer), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`discovery answered ${response.status}`);
  return response.json() as Promise<{ issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string }>;
}

function createConnection(organizationId: string, oidc: Connection['oidc']) {
  const connection: Connection = { object: 'connection', id: id('conn'), organization_id: organizationId, connection_type: 'GenericOIDC', name: `OIDC (${new URL(oidc.issuer).host})`, state: 'active', oidc, created_at: now(), updated_at: now() };
  // One OIDC connection per organization: a new one replaces the previous one.
  save({ connections: [...store.get().connections.filter((x) => x.organization_id !== organizationId), connection] });
  return connection;
}

app.post('/portal/:token/oidc', async (c) => {
  const token = c.req.param('token');
  const portal = portalOf(token);
  if (!portal) return c.html(page('Admin Portal', '<p>This link expired.</p>'), 404);
  const form = await c.req.parseBody();
  const oidc = { issuer: String(form.issuer ?? '').replace(/\/$/, ''), clientId: String(form.clientId ?? ''), clientSecret: String(form.clientSecret ?? '') };
  try {
    const metadata = await discover(oidc.issuer);
    if (metadata.issuer.replace(/\/$/, '') !== oidc.issuer) throw new Error('issuer mismatch');
  } catch (error) {
    return c.html(portalPage(token, undefined, `Could not read the identity provider's configuration: ${(error as Error).message}`), 422);
  }
  if (!oidc.clientId || !oidc.clientSecret) return c.html(portalPage(token, undefined, 'Client ID and secret are required'), 422);
  createConnection(portal.organization.id, oidc);
  return c.html(portalPage(token, 'Connection saved and active.'));
});

app.post('/portal/:token/directory', (c) => {
  const token = c.req.param('token');
  const portal = portalOf(token);
  if (!portal) return c.html(page('Admin Portal', '<p>This link expired.</p>'), 404);
  createDirectory(portal.organization.id);
  return c.html(portalPage(token, 'Directory created: configure SCIM provisioning in your identity provider with the URL and token below.'));
});

// --- Directory Sync: SCIM 2.0 server per directory, events -------------------------------------------------------------

const scimError = (status: number, detail: string) => new Response(JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(status), detail }), { status, headers: { 'Content-Type': 'application/scim+json' } });
const directoryOf = (c: { req: { param(n: string): string; header(n: string): string | undefined } }) => {
  const directory = (store.get().directories ?? []).find((d) => d.id === c.req.param('directory'));
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  return directory && token === directory.token ? directory : null;
};
const scimUser = (u: DirectoryUser) => ({
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], id: u.id, externalId: u.idp_id, userName: u.email, active: u.state === 'active',
  name: { givenName: u.first_name, familyName: u.last_name }, emails: [{ value: u.email, primary: true }], meta: { resourceType: 'User', created: u.created_at, lastModified: u.updated_at },
});
function emit(event: string, user: DirectoryUser) {
  const { groups: _g, ...data } = user;
  save({ events: [...(store.get().events ?? []), { object: 'event', id: id('event'), event, data: { ...data, groups: [] }, created_at: now(), organization_id: user.organization_id }] });
}

app.post('/scim/v2/:directory/Users', async (c) => {
  const directory = directoryOf(c);
  if (!directory) return scimError(401, 'Invalid SCIM token');
  const body = await c.req.json<{ userName?: string; externalId?: string; active?: boolean; name?: { givenName?: string; familyName?: string }; emails?: Array<{ value: string; primary?: boolean }> }>();
  const email = (body.emails?.find((e) => e.primary)?.value ?? body.emails?.[0]?.value ?? body.userName ?? '').toLowerCase();
  if (!email) return scimError(400, 'userName or emails is required');
  if ((store.get().users ?? []).some((u) => u.directory_id === directory.id && u.email === email)) return scimError(409, 'User already exists');
  const user: DirectoryUser = {
    object: 'directory_user', id: id('directory_user'), directory_id: directory.id, organization_id: directory.organization_id, idp_id: body.externalId ?? email, email,
    first_name: body.name?.givenName ?? null, last_name: body.name?.familyName ?? null, state: body.active === false ? 'inactive' : 'active',
    raw_attributes: body as Record<string, unknown>, custom_attributes: {}, groups: [], created_at: now(), updated_at: now(),
  };
  save({ users: [...(store.get().users ?? []), user] });
  emit('dsync.user.created', user);
  return new Response(JSON.stringify(scimUser(user)), { status: 201, headers: { 'Content-Type': 'application/scim+json' } });
});

app.get('/scim/v2/:directory/Users/:id', (c) => {
  const directory = directoryOf(c);
  if (!directory) return scimError(401, 'Invalid SCIM token');
  const user = (store.get().users ?? []).find((u) => u.id === c.req.param('id') && u.directory_id === directory.id);
  return user ? c.json(scimUser(user)) : scimError(404, 'User not found');
});

app.patch('/scim/v2/:directory/Users/:id', async (c) => {
  const directory = directoryOf(c);
  if (!directory) return scimError(401, 'Invalid SCIM token');
  const user = (store.get().users ?? []).find((u) => u.id === c.req.param('id') && u.directory_id === directory.id);
  if (!user) return scimError(404, 'User not found');
  const body = await c.req.json<{ Operations?: Array<{ op: string; path?: string; value?: unknown }> }>();
  const next = { ...user, updated_at: now() };
  for (const op of body.Operations ?? []) {
    const value = (op.path ? { [op.path]: op.value } : op.value) as Record<string, unknown>;
    if ('active' in value) next.state = value.active === false || value.active === 'False' ? 'inactive' : 'active';
    if (typeof value['name.givenName'] === 'string') next.first_name = value['name.givenName'] as string;
    if (typeof value['name.familyName'] === 'string') next.last_name = value['name.familyName'] as string;
  }
  save({ users: (store.get().users ?? []).map((u) => (u.id === user.id ? next : u)) });
  emit('dsync.user.updated', next);
  return c.json(scimUser(next));
});

app.delete('/scim/v2/:directory/Users/:id', (c) => {
  const directory = directoryOf(c);
  if (!directory) return scimError(401, 'Invalid SCIM token');
  const user = (store.get().users ?? []).find((u) => u.id === c.req.param('id') && u.directory_id === directory.id);
  if (!user) return scimError(404, 'User not found');
  save({ users: (store.get().users ?? []).filter((u) => u.id !== user.id) });
  emit('dsync.user.deleted', { ...user, state: 'inactive' });
  return c.body(null, 204);
});

app.use('/events', async (c, next) => (authorised(c.req.header('authorization')) ? next() : apiError('Unauthorized', 401, 'unauthorized')));
app.get('/events', (c) => {
  const q = new URL(c.req.url).searchParams;
  const types = q.getAll('events').concat(q.getAll('events[]')).flatMap((t) => t.split(',')).filter(Boolean);
  const organizationId = q.get('organization_id');
  const after = q.get('after');
  const limit = Math.min(Number(q.get('limit') ?? 100), 100);
  let events = (store.get().events ?? []).filter((e) => (!types.length || types.includes(e.event)) && (!organizationId || e.organization_id === organizationId));
  if (after) {
    const index = events.findIndex((e) => e.id === after);
    events = index >= 0 ? events.slice(index + 1) : events;
  }
  const page = events.slice(0, limit).map(({ organization_id: _o, ...e }) => e);
  return c.json({ object: 'list', data: page, list_metadata: { after: page.at(-1)?.id ?? after ?? null } });
});

// --- SSO ---------------------------------------------------------------------------------------------------------------

app.get('/sso/authorize', async (c) => {
  const q = new URL(c.req.url).searchParams;
  if (q.get('response_type') !== 'code' || !q.get('client_id') || !q.get('redirect_uri')) return c.html(page('WorkOS', '<p>Invalid authorization request</p>'), 400);
  const connection = store.get().connections.find((x) => x.state === 'active' && (x.id === q.get('connection') || x.organization_id === q.get('organization')));
  if (!connection) return c.html(page('WorkOS', '<p>No active SSO connection for this organization</p>'), 400);
  const metadata = await discover(connection.oidc.issuer);
  const internal = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(32).toString('base64url');
  authRequests.set(internal, { clientId: q.get('client_id')!, redirectUri: q.get('redirect_uri')!, state: q.get('state'), connectionId: connection.id, codeVerifier, expiresAt: Date.now() + 10 * 60_000 });
  const target = new URL(metadata.authorization_endpoint);
  target.search = new URLSearchParams({
    client_id: connection.oidc.clientId, redirect_uri: `${base}/sso/oidc/callback`, response_type: 'code', scope: 'openid email profile groups', state: internal,
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'), code_challenge_method: 'S256',
    ...(q.get('login_hint') ? { login_hint: q.get('login_hint')! } : {}),
  }).toString();
  return c.redirect(target.toString(), 302);
});

app.get('/sso/oidc/callback', async (c) => {
  const q = new URL(c.req.url).searchParams;
  const request = authRequests.get(q.get('state') ?? '');
  authRequests.delete(q.get('state') ?? '');
  if (!request || request.expiresAt < Date.now()) return c.html(page('WorkOS', '<p>The sign-in expired. Start again.</p>'), 400);
  const connection = store.get().connections.find((x) => x.id === request.connectionId)!;
  const metadata = await discover(connection.oidc.issuer);
  const tokenResponse = await fetch(metadata.token_endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code') ?? '', redirect_uri: `${base}/sso/oidc/callback`, client_id: connection.oidc.clientId, client_secret: connection.oidc.clientSecret, code_verifier: request.codeVerifier }),
  });
  if (!tokenResponse.ok) return c.html(page('WorkOS', `<p>The identity provider refused the sign-in (${tokenResponse.status}).</p>`), 502);
  const { id_token: idToken } = await tokenResponse.json() as { id_token: string };
  const { payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL(metadata.jwks_uri)), { issuer: metadata.issuer, audience: connection.oidc.clientId });
  const email = String(payload.email ?? '');
  const profile: Profile = {
    id: `prof_${createHash('sha256').update(`${connection.id}:${payload.sub}`).digest('hex').slice(0, 26).toUpperCase()}`,
    idp_id: String(payload.sub), organization_id: connection.organization_id, connection_id: connection.id, connection_type: connection.connection_type,
    email, first_name: (payload.given_name as string) ?? null, last_name: (payload.family_name as string) ?? null, name: (payload.name as string) ?? null,
    groups: (payload.groups as string[]) ?? [], raw_attributes: payload as Record<string, unknown>,
  };
  const code = randomBytes(20).toString('base64url');
  codes.set(code, { profile, clientId: request.clientId, expiresAt: Date.now() + 10 * 60_000 });
  const target = new URL(request.redirectUri);
  target.searchParams.set('code', code);
  if (request.state) target.searchParams.set('state', request.state);
  return c.redirect(target.toString(), 302);
});

app.post('/sso/token', async (c) => {
  const form = await c.req.parseBody();
  if (!String(form.client_secret ?? '').startsWith('sk_')) return apiError('Invalid client secret', 401, 'invalid_client');
  if (form.grant_type !== 'authorization_code') return apiError('Unsupported grant type', 400, 'unsupported_grant_type');
  const entry = codes.get(String(form.code ?? ''));
  codes.delete(String(form.code ?? ''));
  if (!entry || entry.expiresAt < Date.now() || entry.clientId !== form.client_id) return apiError('The code is invalid or expired', 400, 'invalid_grant');
  return c.json({ access_token: randomBytes(20).toString('base64url'), profile: entry.profile });
});

// --- control -----------------------------------------------------------------------------------------------------------

app.get('/__control/organizations', (c) => c.json(store.get().organizations));
app.post('/__control/dns', async (c) => {
  const { name, txt } = await c.req.json<{ name: string; txt: string }>();
  save({ dns: { ...store.get().dns, [name.toLowerCase()]: [...(store.get().dns[name.toLowerCase()] ?? []), txt] } });
  return c.json({ name, txt });
});
app.post('/__control/directories', async (c) => {
  const { organizationId } = await c.req.json<{ organizationId: string }>();
  if (!org(organizationId)) return apiError('Organization not found', 404);
  const directory = createDirectory(organizationId);
  return c.json({ id: directory.id, endpoint: `${base}/scim/v2/${directory.id}`, token: directory.token }, 201);
});

app.post('/__control/connections', async (c) => {
  const { organizationId, issuer, clientId, clientSecret } = await c.req.json<{ organizationId: string; issuer: string; clientId: string; clientSecret: string }>();
  if (!org(organizationId)) return apiError('Organization not found', 404);
  return c.json(publicConnection(createConnection(organizationId, { issuer: issuer.replace(/\/$/, ''), clientId, clientSecret })), 201);
});

service.start();
