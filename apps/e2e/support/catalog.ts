/**
 * The authorization model as specified in docs/architecture/authorization.md. The suite encodes the specification
 * independently of the implementation, so a drift between docs and code shows up as failing tests.
 */
export const SYSTEM_ROLES = [
  'admin',
  'compliance_officer',
  'senior_reviewer',
  'reviewer',
  'relationship_manager',
  'flow_designer',
  'integration_manager',
  'support_agent',
  'auditor',
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const TENANT_PERMISSIONS = [
  'workspace:read', 'workspace:update', 'domains:manage', 'security:manage',
  'members:read', 'members:invite', 'members:update', 'members:deactivate',
  'roles:read', 'roles:manage',
  'clients:read', 'clients:update', 'clients:provision', 'clients:records',
  'experience:read', 'experience:manage', 'experience:publish',
  'backoffice:read', 'backoffice:manage', 'backoffice:publish',
  'forms:read', 'forms:manage', 'forms:publish',
  'workflows:read', 'workflows:manage', 'workflows:publish',
  'templates:manage', 'variables:read', 'variables:manage',
  'integrations:read', 'integrations:manage', 'integrations:use',
  'api_clients:manage', 'webhooks:manage',
  'cases:read', 'cases:read_all', 'cases:lookup', 'cases:create', 'cases:signal', 'events:publish',
  'tasks:work', 'tasks:assign', 'cases:approve_high_risk', 'screening:adjudicate', 'cases:export',
  'audit:read', 'audit:export', 'data_requests:manage', 'support_access:approve',
] as const;
export type TenantPermission = (typeof TENANT_PERMISSIONS)[number];

const READ_ONLY_OVERSIGHT: TenantPermission[] = [
  'workspace:read', 'members:read', 'roles:read', 'clients:read', 'forms:read', 'workflows:read', 'variables:read',
  'integrations:read', 'cases:read', 'cases:read_all', 'audit:read', 'audit:export', 'experience:read', 'backoffice:read',
];

export const ROLE_PERMISSIONS: Record<SystemRole, readonly TenantPermission[]> = {
  admin: TENANT_PERMISSIONS,
  compliance_officer: [
    'workspace:read', 'members:read', 'roles:read', 'clients:read', 'clients:update', 'forms:read', 'workflows:read', 'workflows:publish',
    'integrations:read', 'cases:read', 'cases:read_all', 'cases:create', 'tasks:work', 'tasks:assign', 'cases:approve_high_risk',
    'screening:adjudicate', 'cases:export', 'audit:read', 'audit:export', 'data_requests:manage',
  ],
  senior_reviewer: [
    'workspace:read', 'members:read', 'clients:read', 'forms:read', 'workflows:read', 'cases:read', 'cases:read_all',
    'tasks:work', 'tasks:assign', 'cases:approve_high_risk',
  ],
  reviewer: ['workspace:read', 'clients:read', 'forms:read', 'workflows:read', 'cases:read', 'tasks:work'],
  relationship_manager: ['workspace:read', 'clients:read', 'clients:update', 'cases:read', 'cases:create'],
  flow_designer: [
    'workspace:read', 'members:read', 'roles:read', 'forms:read', 'forms:manage', 'forms:publish', 'workflows:read',
    'workflows:manage', 'workflows:publish', 'templates:manage', 'variables:read', 'variables:manage',
    'integrations:read', 'integrations:use', 'experience:read', 'experience:manage', 'experience:publish',
    'backoffice:read', 'backoffice:manage', 'backoffice:publish',
  ],
  integration_manager: [
    'workspace:read', 'workflows:read', 'variables:read', 'integrations:read', 'integrations:manage', 'integrations:use',
    'api_clients:manage', 'webhooks:manage', 'clients:provision', 'clients:records', 'experience:read', 'cases:signal', 'events:publish',
  ],
  support_agent: ['workspace:read', 'clients:read', 'clients:update', 'cases:read', 'cases:lookup'],
  auditor: READ_ONLY_OVERSIGHT,
};

export const PLATFORM_ROLES = ['platform_admin', 'customer_success', 'support', 'platform_auditor'] as const;
