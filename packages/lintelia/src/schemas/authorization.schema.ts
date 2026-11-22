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
  p('clients:provision', 'Provision clients', "Register clients from the institution's systems and open sessions for embedded apps", 'Clients'),
  p('clients:records', 'Client data', "Write the data clients see in their app (accounts, cards, transactions…)", 'Clients'),
  p('experience:read', 'View client app', 'See the client app: pages, journeys, versions', 'Building'),
  p('experience:manage', 'Edit client app', 'Change the draft of the client app', 'Building'),
  p('experience:publish', 'Publish client app', 'Publish and roll back versions of the client app', 'Building'),
  p('backoffice:read', 'View back office screens', "See the institution's own back-office pages, menu items and actions in the studio", 'Building'),
  p('backoffice:manage', 'Edit back office screens', "Change the draft of the institution's own back-office screens", 'Building'),
  p('backoffice:publish', 'Publish back office screens', "Publish and roll back the institution's own back-office screens", 'Building'),
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
  p('cases:signal', 'Signal cases', "Tell a running case that something happened in the institution's systems (a waiting step continues)", 'Operations'),
  p('events:publish', 'Publish events', "Send events from the institution's systems (POST /events): they reach the cases waiting for them and start the workflows that listen", 'Operations'),
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
  /** Holds every custom permission of the institution too (the administrator). */
  allCustomPermissions?: boolean;
}

const READ_ONLY_OVERSIGHT = [
  'workspace:read', 'members:read', 'roles:read', 'clients:read', 'forms:read', 'workflows:read', 'variables:read',
  'integrations:read', 'cases:read', 'cases:read_all', 'audit:read', 'audit:export', 'experience:read', 'backoffice:read',
];

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  { key: 'admin', name: 'Administrator', description: 'Full access to the institution workspace', permissions: TENANT_PERMISSION_IDS, allCustomPermissions: true },
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
      'workflows:manage', 'workflows:publish', 'templates:manage', 'variables:read', 'variables:manage', 'integrations:read', 'integrations:use',
      'experience:read', 'experience:manage', 'experience:publish', 'backoffice:read', 'backoffice:manage', 'backoffice:publish'],
  },
  {
    key: 'integration_manager', name: 'Integration manager', description: "Connects the institution's systems",
    permissions: ['workspace:read', 'workflows:read', 'variables:read', 'integrations:read', 'integrations:manage', 'integrations:use',
      'api_clients:manage', 'webhooks:manage', 'clients:provision', 'clients:records', 'experience:read', 'cases:signal', 'events:publish'],
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
  p('platform.tenants:recover', 'Recover institution access', 'Restore an administrator of an institution that locked itself out (verified out of band)', 'Platform'),
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

/**
 * Effective permissions of a set of roles (docs/plans/15 §5.1). System roles: the catalogue's permissions plus the
 * institution's extensions (custom permissions stored on the role row); custom roles: what they store. Only ids of the
 * catalogue or of the institution's active custom permissions count; anything else is ignored.
 */
export function resolvePermissions(
  roles: Array<{ key: string; isSystem: boolean; permissions: string[] }>,
  catalog: readonly string[] = TENANT_PERMISSION_IDS,
  systemRoles: SystemRoleDefinition[] = SYSTEM_ROLES,
  customKeys: readonly string[] = [],
): string[] {
  const custom = new Set(customKeys);
  const known = (permission: string) => catalog.includes(permission) || custom.has(permission);
  const result = new Set<string>();
  for (const role of roles) {
    if (role.isSystem) {
      const definition = systemRoles.find((r) => r.key === role.key);
      for (const permission of definition?.permissions ?? []) if (catalog.includes(permission)) result.add(permission);
      for (const permission of role.permissions) if (custom.has(permission)) result.add(permission);
      if (definition?.allCustomPermissions) for (const permission of custom) result.add(permission);
    } else {
      for (const permission of role.permissions) if (known(permission)) result.add(permission);
    }
  }
  return [...result].sort();
}

export function resolvePlatformPermissions(roleKeys: string[]): string[] {
  return resolvePermissions(roleKeys.map((key) => ({ key, isSystem: true, permissions: [] })), PLATFORM_PERMISSION_CATALOG.map((perm) => perm.id), PLATFORM_ROLES);
}

// --- custom permissions (docs/plans/15 §5.1) --------------------------------------------------------------------------

/** Capabilities an institution names itself ("may waive fees"); always prefixed so they can never shadow a built-in id. */
export const CUSTOM_PERMISSION_PREFIX = 'custom:';
export const CUSTOM_PERMISSION_RE = /^custom:[a-z][a-z0-9_.-]{0,62}$/;
export const isCustomPermission = (id: string) => id.startsWith(CUSTOM_PERMISSION_PREFIX);

/** `Waive fees` → `custom:waive_fees`; an explicit key may use dots (`custom:fees.waive`). */
export function customPermissionKey(nameOrKey: string): string {
  const raw = nameOrKey.trim().toLowerCase().replace(/^custom:/, '');
  const slug = raw.replace(/[^a-z0-9_.-]+/g, '_').replace(/^[^a-z]+/, '').replace(/[_.-]+$/g, '').slice(0, 63);
  return slug ? `${CUSTOM_PERMISSION_PREFIX}${slug}` : '';
}

export interface CustomPermissionDefinition extends PermissionDefinition {
  custom: true;
  archived: boolean;
  createdBy?: string | null;
  createdAt?: string | Date;
}

/**
 * Permissions whose holders administer access itself. Members holding one of them are the institution's
 * administrators for notifications of access changes; roles containing one of them are privileged.
 */
export const ACCESS_ADMINISTRATION_PERMISSIONS = ['roles:manage', 'members:update', 'members:invite', 'members:deactivate', 'security:manage', 'api_clients:manage'];

// --- access rules on things (docs/plans/15 §5.2) ----------------------------------------------------------------------

/**
 * Who may use something (start a workflow, see its cases; later pages, menu items, buttons): members holding **all**
 * `permissions`, and holding **one of** `roles` when given, and for whom `when` (JSONata over `member` and the context)
 * is true. An empty rule (no field) allows every member. `when` can only narrow: an error denies.
 */
export interface AccessRule {
  permissions?: string[];
  roles?: string[];
  when?: string;
}

/** Access rules of a workflow: who may start it by hand / by API, and who may see its cases (on top of case scope). */
export interface WorkflowAccess {
  start?: AccessRule;
  cases?: AccessRule;
}

export interface AccessPrincipal {
  permissions: readonly string[];
  roles: readonly string[];
}

const stringList = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()))] : undefined);

/** A rule from YAML or JSON, keeping only the known fields (null when there is no rule). */
export function normalizeAccessRule(raw: unknown): AccessRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const rule: AccessRule = {};
  const permissions = stringList(source.permissions);
  const roles = stringList(source.roles);
  if (permissions?.length) rule.permissions = permissions;
  if (roles?.length) rule.roles = roles;
  if (typeof source.when === 'string' && source.when.trim()) rule.when = source.when.trim();
  return rule;
}

export function normalizeWorkflowAccess(raw: unknown): WorkflowAccess | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const access: WorkflowAccess = {};
  const start = normalizeAccessRule(source.start);
  const cases = normalizeAccessRule(source.cases);
  if (start) access.start = start;
  if (cases) access.cases = cases;
  return access.start || access.cases ? access : null;
}

/** The permission and role parts of a rule (the condition is evaluated by the caller, with JSONata). */
export function satisfiesAccessRule(rule: AccessRule | null | undefined, principal: AccessPrincipal): boolean {
  if (!rule) return true;
  if (rule.permissions?.some((permission) => !principal.permissions.includes(permission))) return false;
  if (rule.roles?.length && !rule.roles.some((role) => principal.roles.includes(role))) return false;
  return true;
}

/** Mistakes in a rule against the institution's catalogue and roles (publication checks). */
export function accessRuleErrors(rule: AccessRule | null | undefined, known: { permissions: readonly string[]; roles: readonly string[] }, where: string): string[] {
  if (!rule) return [];
  const errors: string[] = [];
  for (const permission of rule.permissions ?? []) if (!known.permissions.includes(permission)) errors.push(`${where}: unknown permission "${permission}"`);
  for (const role of rule.roles ?? []) if (!known.roles.includes(role)) errors.push(`${where}: unknown role "${role}"`);
  return errors;
}

export const sameAccess = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
