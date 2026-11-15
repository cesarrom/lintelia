import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { createFakeService, devPort, escapeHtml, jsonState, page } from '@repo/fake-kit';

/**
 * A workforce identity provider speaking OpenID Connect (authorization code flow): discovery, JWKS, a login page,
 * token endpoint (client_secret_post / client_secret_basic), userinfo. ID tokens carry `email`, names, `groups` and
 * `amr` (`pwd`, plus `mfa` for users flagged as using MFA) — what Okta / Entra / Google send.
 *
 * Control API: `POST /__control/clients { redirectUris }` → `{ clientId, clientSecret }`,
 * `POST /__control/users { email, password, name, groups?, mfa? }`.
 */
interface Client { clientId: string; clientSecret: string; redirectUris: string[] }
interface User { email: string; password: string; name: string; groups: string[]; mfa: boolean }
interface Code { clientId: string; redirectUri: string; email: string; nonce: string | null; codeChallenge: string | null; expiresAt: number }

const port = devPort('idp-oidc', 9400);
const issuer = process.env.IDP_OIDC_ISSUER ?? `http://localhost:${port}`;
const service = createFakeService({ name: 'idp-oidc', port, recordPaths: (p) => ['/token', '/authorize', '/userinfo'].includes(p) });
const state = jsonState<{ clients: Client[]; users: User[] }>('idp-oidc', 'state.json', { clients: [], users: [] });
const codes = new Map<string, Code>();
const accessTokens = new Map<string, { email: string; expiresAt: number }>();
service.onReset(() => { state.set({ clients: [], users: [] }); codes.clear(); accessTokens.clear(); });

const keys = await (async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: randomUUID(), alg: 'RS256', use: 'sig' };
  return { privateKey: privateKey as CryptoKey, jwk };
})();

const client = (id: string | undefined) => state.get().clients.find((c) => c.clientId === id);
const user = (email: string) => state.get().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
const oauthError = (error: string, description: string, status = 400) => new Response(JSON.stringify({ error, error_description: description }), { status, headers: { 'Content-Type': 'application/json' } });

const app = service.app;

app.get('/.well-known/openid-configuration', (c) => c.json({
  issuer,
  authorization_endpoint: `${issuer}/authorize`,
  token_endpoint: `${issuer}/token`,
  userinfo_endpoint: `${issuer}/userinfo`,
  jwks_uri: `${issuer}/jwks`,
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  scopes_supported: ['openid', 'email', 'profile', 'groups'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
  claims_supported: ['sub', 'email', 'email_verified', 'name', 'given_name', 'family_name', 'groups', 'amr'],
  code_challenge_methods_supported: ['S256'],
}));

app.get('/jwks', (c) => c.json({ keys: [keys.jwk] }));

const loginPage = (params: URLSearchParams, error?: string) => page('Corporate sign-in', `
<div class="card" style="max-width:380px;margin:40px auto">
  <h2 style="margin-top:0">Sign in to your organisation</h2>
  ${error ? `<p style="color:#b91c1c">${escapeHtml(error)}</p>` : ''}
  <form method="post" action="/authorize/login">
    ${[...params.entries()].map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`).join('')}
    <p><label>E-mail<br><input name="login" type="email" value="${escapeHtml(params.get('login_hint') ?? '')}" style="width:100%"></label></p>
    <p><label>Password<br><input name="password" type="password" style="width:100%"></label></p>
    <button type="submit">Sign-in</button>
  </form>
</div>`, '#4338ca');

app.get('/authorize', (c) => {
  const params = new URL(c.req.url).searchParams;
  const found = client(params.get('client_id') ?? undefined);
  if (!found) return c.html(page('Error', '<p>Unknown client</p>'), 400);
  if (!found.redirectUris.includes(params.get('redirect_uri') ?? '')) return c.html(page('Error', '<p>redirect_uri is not registered for this client</p>'), 400);
  if (params.get('response_type') !== 'code') return c.html(page('Error', '<p>Only response_type=code is supported</p>'), 400);
  return c.html(loginPage(params));
});

app.post('/authorize/login', async (c) => {
  const form = await c.req.parseBody();
  const params = new URLSearchParams(Object.entries(form).filter(([k]) => !['login', 'password'].includes(k)).map(([k, v]) => [k, String(v)]));
  const found = user(String(form.login ?? ''));
  if (!found || found.password !== form.password) return c.html(loginPage(params, 'Wrong e-mail or password'), 401);
  const code = randomBytes(24).toString('base64url');
  codes.set(code, {
    clientId: params.get('client_id')!, redirectUri: params.get('redirect_uri')!, email: found.email, nonce: params.get('nonce'),
    codeChallenge: params.get('code_challenge'), expiresAt: Date.now() + 60_000,
  });
  const target = new URL(params.get('redirect_uri')!);
  target.searchParams.set('code', code);
  if (params.get('state')) target.searchParams.set('state', params.get('state')!);
  return c.redirect(target.toString(), 302);
});

app.post('/token', async (c) => {
  const form = await c.req.parseBody();
  const basic = c.req.header('authorization')?.match(/^Basic (.+)$/)?.[1];
  const [basicId, basicSecret] = basic ? Buffer.from(basic, 'base64').toString().split(':').map(decodeURIComponent) : [];
  const found = client(String(form.client_id ?? basicId ?? ''));
  if (!found || found.clientSecret !== String(form.client_secret ?? basicSecret ?? '')) return oauthError('invalid_client', 'Client authentication failed', 401);
  if (form.grant_type !== 'authorization_code') return oauthError('unsupported_grant_type', 'authorization_code only');
  const entry = codes.get(String(form.code ?? ''));
  codes.delete(String(form.code ?? ''));
  if (!entry || entry.expiresAt < Date.now() || entry.clientId !== found.clientId || entry.redirectUri !== form.redirect_uri) return oauthError('invalid_grant', 'Invalid code');
  if (entry.codeChallenge) {
    const verifier = String(form.code_verifier ?? '');
    if (createHash('sha256').update(verifier).digest('base64url') !== entry.codeChallenge) return oauthError('invalid_grant', 'PKCE verification failed');
  }
  const person = user(entry.email)!;
  const [given, ...rest] = person.name.split(' ');
  const idToken = await new SignJWT({
    email: person.email, email_verified: true, name: person.name, given_name: given, family_name: rest.join(' ') || undefined,
    groups: person.groups, amr: person.mfa ? ['pwd', 'mfa'] : ['pwd'], ...(entry.nonce ? { nonce: entry.nonce } : {}),
  }).setProtectedHeader({ alg: 'RS256', kid: keys.jwk.kid }).setIssuer(issuer).setAudience(found.clientId)
    .setSubject(createHash('sha256').update(person.email.toLowerCase()).digest('hex').slice(0, 24)).setIssuedAt().setExpirationTime('10m').sign(keys.privateKey);
  const accessToken = randomBytes(24).toString('base64url');
  accessTokens.set(accessToken, { email: person.email, expiresAt: Date.now() + 600_000 });
  return c.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 600, id_token: idToken, scope: 'openid email profile groups' });
});

app.get('/userinfo', (c) => {
  const token = c.req.header('authorization')?.replace(/^Bearer /, '') ?? '';
  const entry = accessTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) return oauthError('invalid_token', 'Invalid access token', 401);
  const person = user(entry.email)!;
  return c.json({ sub: createHash('sha256').update(person.email.toLowerCase()).digest('hex').slice(0, 24), email: person.email, name: person.name, groups: person.groups });
});

app.post('/__control/clients', async (c) => {
  const { redirectUris = [] } = await c.req.json<{ redirectUris?: string[] }>().catch(() => ({ redirectUris: [] as string[] }));
  const created: Client = { clientId: `client-${randomBytes(6).toString('hex')}`, clientSecret: randomBytes(24).toString('base64url'), redirectUris };
  state.set({ ...state.get(), clients: [...state.get().clients, created] });
  return c.json(created, 201);
});

app.post('/__control/users', async (c) => {
  const body = await c.req.json<{ email: string; password: string; name?: string; groups?: string[]; mfa?: boolean }>();
  const next: User = { email: body.email, password: body.password, name: body.name ?? body.email, groups: body.groups ?? [], mfa: body.mfa ?? false };
  state.set({ ...state.get(), users: [...state.get().users.filter((u) => u.email.toLowerCase() !== body.email.toLowerCase()), next] });
  return c.json({ email: next.email }, 201);
});

app.get('/', (c) => c.html(page('Fake OIDC identity provider', `<p>Issuer <code>${escapeHtml(issuer)}</code>. ${state.get().users.length} users, ${state.get().clients.length} clients.</p>`, '#4338ca')));

service.start();
