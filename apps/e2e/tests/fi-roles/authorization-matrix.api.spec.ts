import { test } from '@playwright/test';
import { Api, expectAllowed, expectForbidden, type ApiResponse } from '../../support/api';
import { addMember, createTenant, deleteTenant, uniqueEmail, type TenantHandle } from '../../support/factories';
import { ROLE_PERMISSIONS, SYSTEM_ROLES, type SystemRole, type TenantPermission } from '../../support/catalog';
import { minimalWorkflowYaml, simpleFormConfig } from '../../support/workflows';

/**
 * X-02: every system role against one representative operation per permission, as specified in
 * docs/architecture/authorization.md. "Allowed" = the request reaches the operation (2xx or a validation answer);
 * "denied" = 403.
 */
type Probe = (api: Api, bank: TenantHandle) => Promise<ApiResponse>;

const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const PROBES: Partial<Record<TenantPermission, Probe>> = {
  'workspace:read': (api, bank) => api.get(`/tenants?domain=${bank.key}`),
  'workspace:update': (api, bank) => api.put(`/tenants/${bank.key}`, { data: { startWorkingHour: '08:00' } }),
  'security:manage': (api) => api.get('/security/policy'),
  'members:read': (api) => api.get('/users'),
  'members:invite': (api) => api.post('/users', { email: uniqueEmail('probe'), name: 'Probe', roleIds: [] }),
  'roles:read': (api) => api.get('/roles'),
  'roles:manage': (api) => api.post('/roles', { name: `Probe ${stamp()}`, description: '', permissions: [] }),
  'clients:read': (api) => api.get('/clients'),
  'forms:read': (api) => api.get('/forms'),
  'forms:manage': (api) => api.post('/forms', { name: `Probe ${stamp()}`, config: simpleFormConfig('probe') }),
  'workflows:read': (api) => api.get('/workflows'),
  'workflows:manage': (api) => api.post('/workflows', { yaml: minimalWorkflowYaml(`Probe ${stamp()}`) }),
  'variables:manage': (api) => api.put(`/system-variables/probe_${stamp()}`, { value: 'x', description: 'probe', type: 'string' }),
  'integrations:read': (api) => api.get('/integrations'),
  'integrations:manage': (api) => api.post('/integrations/smtp-mailer/install'),
  'api_clients:manage': (api) => api.get('/api-clients'),
  'webhooks:manage': (api) => api.get('/webhooks'),
  'cases:read': (api) => api.get('/cases'),
  'tasks:work': (api) => api.get('/tasks?view=mine'),
  'tasks:assign': (api) => api.get('/tasks?view=all'),
  'audit:read': (api) => api.get('/audit'),
  'data_requests:manage': (api) => api.get('/data-requests'),
};

let bank: TenantHandle;
const sessions = new Map<SystemRole, Api>();

test.beforeAll(async () => {
  bank = await createTenant();
  sessions.set('admin', bank.adminApi);
});
test.afterAll(async () => { await deleteTenant(bank); });

for (const role of SYSTEM_ROLES) {
  const tags = ['@authorization', '@X-02', ...(role === 'auditor' ? ['@AUD-01'] : [])];
  test.describe(`X-02 ${role}`, { tag: tags }, () => {
    test.beforeAll(async () => {
      if (!sessions.has(role)) sessions.set(role, Api.as(await addMember(bank, { roles: [role], label: role })));
    });

    for (const [permission, probe] of Object.entries(PROBES) as Array<[TenantPermission, Probe]>) {
      const allowed = ROLE_PERMISSIONS[role].includes(permission);
      test(`${role} ${allowed ? 'can' : 'cannot'} ${permission}`, async () => {
        const res = await probe(sessions.get(role)!, bank);
        if (allowed) expectAllowed(res);
        else expectForbidden(res);
      });
    }
  });
}
