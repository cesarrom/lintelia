/**
 * Authorization catalogue (docs/architecture/authorization.md). Shared by the API (enforcement) and the web app
 * (showing only what a user can do). System role permissions are defined here, not in the database, so they evolve
 * with releases; custom roles store their permissions and may only use ids from this catalogue.
 */

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
}

const p = (id: string, name: string, description: string, category: string): PermissionDefinition => ({ id, name, description, category });

export const TENANT_PERMISSION_CATALOG: PermissionDefinition[] = [
  p('workspace:read', 'View workspace', 'See the institution profile, branding and settings', 'Workspace'),
  p('workspace:update', 'Edit workspace', 'Change profile, branding and working hours', 'Workspace'),
  p('domains:manage', 'Manage domains', 'Add, verify and remove custom domains', 'Workspace'),
  p('security:manage', 'Manage security', 'SSO, MFA and session policy, SCIM tokens', 'Workspace'),
  p('members:read', 'View members', 'List members and their roles', 'People'),
  p('members:invite', 'Invite members', 'Invite people to the institution', 'People'),
  p('members:update', 'Edit members', 'Change member details and role assignments', 'People'),
  p('members:deactivate', 'Deactivate members', 'Deactivate, reactivate and reset credentials of members', 'People'),
  p('roles:read', 'View roles', 'See roles and the permission catalogue', 'People'),
  p('roles:manage', 'Manage roles', 'Create, change and delete custom roles', 'People'),
  p('clients:read', 'View clients', 'See client profiles in scope', 'Clients'),
  p('clients:update', 'Update clients', 'Contact notes, resend links, flag clients', 'Clients'),
  p('forms:read', 'View forms', 'See forms and their submissions', 'Building'),
  p('forms:manage', 'Edit forms', 'Create and edit forms', 'Building'),
  p('forms:publish', 'Publish forms', 'Publish forms and get embed snippets', 'Building'),
  p('workflows:read', 'View workflows', 'See workflows and their versions', 'Building'),
  p('workflows:manage', 'Edit workflows', 'Create and edit workflow drafts', 'Building'),
  p('workflows:publish', 'Publish workflows', 'Publish workflow versions', 'Building'),
  p('templates:manage', 'Manage templates', 'E-mail and document templates', 'Building'),
  p('variables:read', 'View variables', 'See workspace variables', 'Building'),
  p('variables:manage', 'Manage variables', 'Create and change workspace variables', 'Building'),
  p('integrations:read', 'View integrations', 'See connections (never their secrets)', 'Integrations'),
  p('integrations:manage', 'Manage integrations', 'Create, change and delete connections and their secrets', 'Integrations'),
  p('integrations:use', 'Use integrations', 'Reference connections in workflows', 'Integrations'),
  p('api_clients:manage', 'Manage API clients', 'Create and revoke API credentials', 'Integrations'),
  p('webhooks:manage', 'Manage webhooks', 'Outbound webhook subscriptions', 'Integrations'),
  p('cases:read', 'View cases', 'See cases in scope (assigned, queued, started by me)', 'Operations'),
  p('cases:read_all', 'View all cases', 'See every case of the institution', 'Operations'),
  p('cases:lookup', 'Look up applications', "Find any client's application (never investigations) to help them", 'Operations'),
  p('cases:create', 'Start cases', 'Start applications and investigations', 'Operations'),
  p('tasks:work', 'Work tasks', 'Claim and decide tasks routed to me', 'Operations'),
  p('tasks:assign', 'Assign tasks', 'Reassign tasks and manage queues', 'Operations'),
  p('cases:approve_high_risk', 'High-risk decisions', 'Decide above the authority threshold and give second approvals', 'Operations'),
  p('screening:adjudicate', 'Adjudicate screening', 'Resolve AML/sanctions/PEP hits and suspicious activity', 'Operations'),
  p('cases:export', 'Export cases', 'Export case evidence packs', 'Operations'),
  p('audit:read', 'View audit log', 'Read the audit log', 'Oversight'),
  p('audit:export', 'Export audit log', 'Export the audit log', 'Oversight'),
  p('data_requests:manage', 'Data-rights requests', "Handle clients' data export and erasure requests", 'Oversight'),
  p('support_access:approve', 'Approve support access', 'Approve or revoke platform support access', 'Oversight'),
];

export const TENANT_PERMISSION_IDS = TENANT_PERMISSION_CATALOG.map((perm) => perm.id);

export interface SystemRoleDefinition {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

const READ_ONLY_OVERSIGHT = [
  'workspace:read', 'members:read', 'roles:read', 'clients:read', 'forms:read', 'workflows:read', 'variables:read',
  'integrations:read', 'cases:read', 'cases:read_all', 'audit:read', 'audit:export',
];

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  { key: 'admin', name: 'Administrator', description: 'Full access to the institution workspace', permissions: TENANT_PERMISSION_IDS },
  {
    key: 'compliance_officer', name: 'Compliance officer', description: 'Second line: AML/KYC policy, screening hits, high-risk approvals, audit',
    permissions: ['workspace:read', 'members:read', 'roles:read', 'clients:read', 'clients:update', 'forms:read', 'workflows:read', 'workflows:publish',
      'integrations:read', 'cases:read', 'cases:read_all', 'cases:create', 'tasks:work', 'tasks:assign', 'cases:approve_high_risk',
      'screening:adjudicate', 'cases:export', 'audit:read', 'audit:export', 'data_requests:manage'],
  },
  {
    key: 'senior_reviewer', name: 'Senior reviewer', description: 'Team lead: second approvals, reassignments, escalations',
    permissions: ['workspace:read', 'members:read', 'clients:read', 'forms:read', 'workflows:read', 'cases:read', 'cases:read_all',
      'tasks:work', 'tasks:assign', 'cases:approve_high_risk'],
  },
  {
    key: 'reviewer', name: 'Reviewer', description: 'First line analyst: works the queue, decides within authority',
    permissions: ['workspace:read', 'clients:read', 'forms:read', 'workflows:read', 'cases:read', 'tasks:work'],
  },
  {
    key: 'relationship_manager', name: 'Relationship manager', description: 'Starts assisted applications and follows own clients',
    permissions: ['workspace:read', 'clients:read', 'clients:update', 'cases:read', 'cases:create'],
  },
  {
    key: 'flow_designer', name: 'Flow designer', description: 'Builds and publishes forms and workflows',
    permissions: ['workspace:read', 'members:read', 'roles:read', 'forms:read', 'forms:manage', 'forms:publish', 'workflows:read',
      'workflows:manage', 'workflows:publish', 'templates:manage', 'variables:read', 'variables:manage', 'integrations:read', 'integrations:use'],
  },
  {
    key: 'integration_manager', name: 'Integration manager', description: "Connects the institution's systems",
    permissions: ['workspace:read', 'workflows:read', 'variables:read', 'integrations:read', 'integrations:manage', 'integrations:use',
      'api_clients:manage', 'webhooks:manage'],
  },
  {
    key: 'support_agent', name: 'Support agent', description: 'Looks up application status and resends links; no decisions',
    permissions: ['workspace:read', 'clients:read', 'clients:update', 'cases:read', 'cases:lookup'],
  },
  { key: 'auditor', name: 'Auditor', description: 'Read-only oversight', permissions: READ_ONLY_OVERSIGHT },
];

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((role) => role.key);

export const PLATFORM_PERMISSION_CATALOG: PermissionDefinition[] = [
  p('platform.tenants:read', 'View institutions', 'List institutions and their status', 'Platform'),
  p('platform.tenants:create', 'Onboard institutions', 'Create institutions and invite their administrators', 'Platform'),
  p('platform.tenants:update', 'Manage institution lifecycle', 'Suspend and reactivate institutions', 'Platform'),
  p('platform.tenants:delete', 'Offboard institutions', 'Delete suspended institutions', 'Platform'),
  p('platform.staff:manage', 'Manage staff', 'Invite staff and assign platform roles', 'Platform'),
  p('platform.support_access:request', 'Request support access', 'Ask an institution for time-bound access', 'Platform'),
  p('platform.audit:read', 'View platform audit log', 'Read the platform audit log', 'Platform'),
  p('platform.connectors:manage', 'Manage connectors', 'Maintain the connector catalogue', 'Platform'),
];

export const PLATFORM_ROLES: SystemRoleDefinition[] = [
  { key: 'platform_admin', name: 'Platform administrator', description: 'Full platform access (never tenant data)', permissions: PLATFORM_PERMISSION_CATALOG.map((perm) => perm.id) },
  { key: 'customer_success', name: 'Customer success', description: 'Onboards institutions and manages their lifecycle', permissions: ['platform.tenants:read', 'platform.tenants:create', 'platform.tenants:update'] },
  { key: 'support', name: 'Support engineer', description: 'Troubleshoots with institution-approved access', permissions: ['platform.tenants:read', 'platform.support_access:request'] },
  { key: 'platform_auditor', name: 'Platform auditor', description: 'Reads the platform audit log', permissions: ['platform.tenants:read', 'platform.audit:read'] },
];

/** Effective permissions of a set of roles; custom role permissions outside the catalogue are ignored. */
export function resolvePermissions(roles: Array<{ key: string; isSystem: boolean; permissions: string[] }>, catalog = TENANT_PERMISSION_IDS, systemRoles = SYSTEM_ROLES): string[] {
  const result = new Set<string>();
  for (const role of roles) {
    const source = role.isSystem ? systemRoles.find((r) => r.key === role.key)?.permissions ?? [] : role.permissions;
    for (const permission of source) if (catalog.includes(permission)) result.add(permission);
  }
  return [...result].sort();
}

export function resolvePlatformPermissions(roleKeys: string[]): string[] {
  return resolvePermissions(roleKeys.map((key) => ({ key, isSystem: true, permissions: [] })), PLATFORM_PERMISSION_CATALOG.map((perm) => perm.id), PLATFORM_ROLES);
}
