import { expect } from '@playwright/test';
import { expectStatus, type Api } from './api';
import { controlFake, requireFake } from './fakes';
import type { TenantHandle } from './factories';

/**
 * What an institution's IT does to set up SSO through the broker (docs/plans/02): open the Admin Portal link from the
 * workspace, add and verify its e-mail domain (a DNS TXT record), and connect its IdP (OIDC). The portal pages are
 * the WorkOS emulator's; the IdP is fake-services/idp-oidc.
 */
const formPost = (url: string, values: Record<string, string>) => fetch(url, { method: 'POST', body: new URLSearchParams(values), redirect: 'manual' });

export async function setUpSso(bank: TenantHandle, opts: { domain: string; verify?: boolean; connect?: boolean } = { domain: '' }) {
  return setUpSsoWith(bank.adminApi, '/sso', opts);
}

/** The same for any realm: `/sso` (an institution, as its admin) or `/platform/sso` (the staff, as a platform admin). */
export async function setUpSsoWith(api: Api, basePath: string, opts: { domain: string; verify?: boolean; connect?: boolean }) {
  const issuer = await requireFake('oidcIdp');
  const workos = await requireFake('workos');
  const linked = await api.post(`${basePath}/setup-link`, { intent: 'sso' });
  expectStatus(linked, 201);
  const link = linked.body.link as string;
  expect(link).toContain(new URL(workos).host);

  // Domain: add it, publish the TXT record the portal asks for, verify.
  const added = await (await formPost(`${link}/domains`, { domain: opts.domain })).text();
  if (opts.verify !== false) {
    const record = added.match(/<code>([^<]+) TXT &quot;([0-9a-f]+)&quot;<\/code>/);
    expect(record, 'the portal shows the DNS record to create').toBeTruthy();
    await controlFake('workos', '/dns', { name: record![1], txt: record![2] });
    const page = await (await fetch(link)).text();
    const domainId = page.match(/\/domains\/(org_domain_[A-Z0-9]+)\/verify/)![1];
    const verified = await (await formPost(`${link}/domains/${domainId}/verify`, {})).text();
    expect(verified).toContain(`${opts.domain} is verified`);
  }

  // Connection: register our broker's callback at the IdP, then paste the client credentials in the portal.
  let client: { clientId: string; clientSecret: string } | null = null;
  if (opts.connect !== false) {
    client = await controlFake('oidcIdp', '/clients', { redirectUris: [`${workos}/sso/oidc/callback`] });
    const saved = await (await formPost(`${link}/oidc`, { issuer, clientId: client!.clientId, clientSecret: client!.clientSecret })).text();
    expect(saved).toContain('Connection saved and active');
  }
  return { link, issuer, client };
}

/** A person at the fake IdP: its groups and extra ID token claims (department, region…) reach the SSO profile. */
export const idpUser = (email: string, opts: { password?: string; name?: string; mfa?: boolean; groups?: string[]; claims?: Record<string, unknown> } = {}) =>
  controlFake('oidcIdp', '/users', { email, password: opts.password ?? 'idp-password-1', name: opts.name ?? 'Jane Doe', mfa: opts.mfa ?? true, groups: opts.groups ?? [], claims: opts.claims ?? {} });

/** Follow the SSO round trip without a browser: discovery → broker → IdP login form → back to the web app's hand-off. */
export async function ssoSignInWithoutBrowser(redirectUrl: string, email: string, password = 'idp-password-1') {
  let url = redirectUrl;
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(url, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (!location) {
      // The IdP's login form.
      const html = await response.text();
      const hidden = Object.fromEntries([...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map((m) => [m[1], m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"')]));
      const login = await formPost(new URL('/authorize/login', url).toString(), { ...hidden, login: email, password });
      url = login.headers.get('location') ?? '';
      if (!url) throw new Error(`IdP login failed (${login.status})`);
      continue;
    }
    url = new URL(location, url).toString();
    if (url.includes('/sign-on?')) return new URL(url);
  }
  return new URL(url);
}
