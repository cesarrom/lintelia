import { test, expect } from '@playwright/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { controlFake } from '../../support/fakes';

let bank: TenantHandle;
let other: TenantHandle;
test.beforeAll(async () => { [bank, other] = await Promise.all([createTenant(), createTenant()]); });
test.afterAll(async () => { await Promise.all([deleteTenant(bank), deleteTenant(other)]); });

test.describe('FIA-02 Maintain the institution profile and branding', { tag: ['@fi-admin', '@FIA-02'] }, () => {
  test('administrators update name and palette, visible on the public sign-in branding', async () => {
    const pallette = { primary: '#123456', secondary: '#fafafa', accent: '#ff6600' };
    expectStatus(await bank.adminApi.put(`/tenants/${bank.key}`, { data: { name: 'Renamed Bank', pallette } }), 200);
    const branding = await Api.anonymous().get(`/auth/tenant?domain=${bank.host}`);
    expect(branding.body).toMatchObject({ name: 'Renamed Bank', pallette });
  });

  test('administrators cannot change another institution', async () => {
    expectForbidden(await bank.adminApi.put(`/tenants/${other.key}`, { data: { name: 'Hijacked' } }));
  });

  test('members without workspace:update cannot change the profile', async () => {
    const reviewer = await addMember(bank, { roles: ['reviewer'] });
    expectForbidden(await Api.as(reviewer).put(`/tenants/${bank.key}`, { data: { name: 'Reviewer was here' } }));
  });
});

test.describe('FIA-03 Custom domains with ownership verification', { tag: ['@fi-admin', '@FIA-03'] }, () => {
  test('adding a domain returns a TXT challenge and the domain stays unverified', async () => {
    const hostname = `onboarding.${bank.key}.example`;
    const added = await bank.adminApi.post('/domains', { hostname });
    expectStatus(added, 201);
    expect(added.body).toMatchObject({ hostname, status: 'pending_verification', verification: { type: 'TXT' } });
    expect(added.body.verification.name).toContain(hostname);
  });

  test('an unverified domain does not serve the institution', async () => {
    const hostname = `apply.${bank.key}.example`;
    expectStatus(await bank.adminApi.post('/domains', { hostname }), 201);
    expectStatus(await Api.anonymous().get(`/auth/tenant?domain=${hostname}`), 404);
  });

  test('verification fails while the DNS record is missing', async () => {
    const hostname = `verify.${bank.key}.example`;
    expectStatus(await bank.adminApi.post('/domains', { hostname }), 201);
    expectStatus(await bank.adminApi.post(`/domains/${hostname}/verify`), 422);
  });

  test('once the TXT record exists the domain is verified and serves the institution', async () => {
    const hostname = `portal.${bank.key}.example`;
    const added = await bank.adminApi.post('/domains', { hostname });
    await controlFake('dns', '/records', { name: added.body.verification.name, type: 'TXT', value: added.body.verification.value });
    const verified = await bank.adminApi.post(`/domains/${hostname}/verify`);
    expectStatus(verified, 200);
    expect(verified.body.status).toBe('active');
    expect((await Api.anonymous().get(`/auth/tenant?domain=${hostname}`)).body.domain).toBe(bank.key);
  });

  test('a host name claimed by one institution cannot be claimed by another (no domain takeover)', async () => {
    const hostname = `shared.${bank.key}.example`;
    const added = await bank.adminApi.post('/domains', { hostname });
    expectStatus(added, 201);
    expectStatus(await other.adminApi.post('/domains', { hostname }), 409);
    // Nor directly through the workspace profile: institutions add hosts only through verified domains.
    expectStatus(await other.adminApi.put(`/tenants/${other.key}`, { data: { allowedDomains: [hostname] } }), [403, 409]);
    await controlFake('dns', '/records', { name: added.body.verification.name, type: 'TXT', value: added.body.verification.value });
    expectStatus(await bank.adminApi.post(`/domains/${hostname}/verify`), 200);
    expectStatus(await other.adminApi.put(`/tenants/${other.key}`, { data: { allowedDomains: [hostname] } }), 409);
    const resolved = await Api.anonymous().get(`/auth/tenant?domain=${hostname}`);
    expect(resolved.body.domain).toBe(bank.key);
  });
});
