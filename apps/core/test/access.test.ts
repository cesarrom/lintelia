import { describe, expect, test } from 'bun:test';
import {
  SYSTEM_ROLES, TENANT_PERMISSION_IDS, accessRuleErrors, customPermissionKey, normalizeWorkflowAccess, resolvePermissions,
  sameAccess, satisfiesAccessRule,
} from '@repo/fintivio/schemas';
import { desiredAssignments, mappedRoles, planMember } from '../src/access/role-sync';
import { coerce } from '../src/access/attributes';
import { stepRoleKeys } from '../src/access/queries.service';
import { parseEffectiveAt } from '../src/access/changes';
import { allows, conditionError } from '../src/access/rules';

/** Access control building blocks (docs/plans/15) — no database. */
const reviewer = SYSTEM_ROLES.find((r) => r.key === 'reviewer')!;

describe('permission resolution with custom permissions', () => {
  test('a system role keeps its catalogue permissions and adds only active custom ones', () => {
    const row = { key: 'reviewer', isSystem: true, permissions: ['custom:fees.waive', 'custom:archived', 'cases:read_all'] };
    const resolved = resolvePermissions([row], TENANT_PERMISSION_IDS, undefined, ['custom:fees.waive']);
    expect(resolved).toEqual([...reviewer.permissions, 'custom:fees.waive'].sort());
    // A built-in stored on a system row is ignored: the platform decides those.
    expect(resolved).not.toContain('cases:read_all');
    expect(resolved).not.toContain('custom:archived');
  });

  test('the administrator holds every active custom permission', () => {
    const resolved = resolvePermissions([{ key: 'admin', isSystem: true, permissions: [] }], TENANT_PERMISSION_IDS, undefined, ['custom:a', 'custom:b']);
    expect(resolved).toEqual(expect.arrayContaining(['custom:a', 'custom:b', 'roles:manage']));
  });

  test('custom roles hold what they store, within the catalogue and the active custom keys', () => {
    const resolved = resolvePermissions([{ key: 'desk', isSystem: false, permissions: ['cases:read', 'custom:a', 'custom:gone', 'not:real'] }], TENANT_PERMISSION_IDS, undefined, ['custom:a']);
    expect(resolved).toEqual(['cases:read', 'custom:a']);
  });

  test('custom permission keys are prefixed and slugged', () => {
    expect(customPermissionKey('Waive fees')).toBe('custom:waive_fees');
    expect(customPermissionKey('custom:fees.waive')).toBe('custom:fees.waive');
    expect(customPermissionKey('cases:read')).toBe('custom:cases_read');
    expect(customPermissionKey('!!!')).toBe('');
  });
});

describe('access rules', () => {
  const principal = { permissions: ['cases:create', 'custom:x'], roles: ['reviewer'] };
  test('all permissions and one of the roles', () => {
    expect(satisfiesAccessRule(undefined, principal)).toBe(true);
    expect(satisfiesAccessRule({ permissions: ['custom:x'] }, principal)).toBe(true);
    expect(satisfiesAccessRule({ permissions: ['custom:x', 'custom:y'] }, principal)).toBe(false);
    expect(satisfiesAccessRule({ roles: ['auditor', 'reviewer'] }, principal)).toBe(true);
    expect(satisfiesAccessRule({ roles: ['auditor'] }, principal)).toBe(false);
  });

  test('conditions only narrow; an error denies', async () => {
    const subject = { userId: 'u', email: 'a@b.c', kind: 'member', roles: ['reviewer'], permissions: ['custom:x'], attributes: { region: 'EU', limit: 500 } };
    expect(await allows({ when: "member.attributes.region = 'EU'" }, subject)).toBe(true);
    expect(await allows({ when: 'member.attributes.limit > 1000' }, subject)).toBe(false);
    expect(await allows({ permissions: ['custom:y'], when: 'true' }, subject)).toBe(false);
    expect(await allows({ when: '$error("boom")' }, subject)).toBe(false);
    expect(conditionError('member.attributes.region = ')).toBeTruthy();
    expect(conditionError("member.attributes.region = 'EU'")).toBeNull();
  });

  test('workflow access from YAML, comparisons and publication errors', () => {
    const access = normalizeWorkflowAccess({ start: { permissions: ['custom:x', 'custom:x', ''], extra: 1 }, cases: {} });
    expect(access).toEqual({ start: { permissions: ['custom:x'] }, cases: {} });
    expect(normalizeWorkflowAccess({})).toBeNull();
    expect(sameAccess(access, { start: { permissions: ['custom:x'] }, cases: {} })).toBe(true);
    expect(sameAccess(null, undefined)).toBe(true);
    expect(accessRuleErrors({ permissions: ['custom:nope'], roles: ['ghost'] }, { permissions: ['custom:x'], roles: ['reviewer'] }, 'Start'))
      .toEqual(['Start: unknown permission "custom:nope"', 'Start: unknown role "ghost"']);
  });
});

describe('roles from the identity provider', () => {
  const mappings = [{ group: 'KYC-Analysts', role: 'reviewer' }, { group: 'Leads', role: 'senior_reviewer' }, { group: 'leads', role: 'reviewer' }];
  test('groups match case-insensitively; each role remembers the groups that give it', () => {
    expect([...mappedRoles(mappings, ['kyc-analysts', 'LEADS'])]).toEqual([['reviewer', ['kyc-analysts', 'LEADS']], ['senior_reviewer', ['LEADS']]]);
  });
  test('a sync never removes the administrator role while no group maps to it, nor from the last administrator', () => {
    const base = { groups: ['Everyone'], defaults: [], current: [{ role: 'admin', source: 'manual' }, { role: 'auditor', source: 'manual' }], active: true };
    const noAdminMapping = planMember({ ...base, mappings, otherActiveAdmin: true });
    expect(noAdminMapping).toMatchObject({ kept: 'no_admin_mapping', next: ['admin'], removals: ['auditor'] });
    const withAdmin = [...mappings, { group: 'Admins', role: 'admin' }];
    expect(planMember({ ...base, mappings: withAdmin, otherActiveAdmin: false })).toMatchObject({ kept: 'last_admin', next: ['admin'] });
    expect(planMember({ ...base, mappings: withAdmin, otherActiveAdmin: true })).toMatchObject({ kept: null, next: [] });
    // Roles restored by platform staff are only removed by hand.
    expect(planMember({ ...base, current: [{ role: 'admin', source: 'recovery' }], mappings: withAdmin, otherActiveAdmin: true }).next).toEqual(['admin']);
  });

  test('the default roles apply only when no group maps', () => {
    expect(desiredAssignments(mappings, ['Everyone'], ['support_agent'])).toEqual([{ role: 'support_agent', source: 'default', groups: [] }]);
    expect(desiredAssignments(mappings, ['Leads'], ['support_agent']).map((d) => d.role).sort()).toEqual(['reviewer', 'senior_reviewer']);
  });
});

describe('member attributes', () => {
  test('values take their declared type', () => {
    expect(coerce({ type: 'number', options: [] }, '1 000')).toBeNull();
    expect(coerce({ type: 'number', options: [] }, '1500')).toBe(1500);
    expect(coerce({ type: 'list', options: [] }, 'a, b,a')).toEqual(['a', 'b']);
    expect(coerce({ type: 'select', options: ['EU', 'US'] }, 'EU')).toBe('EU');
    expect(coerce({ type: 'select', options: ['EU', 'US'] }, 'APAC')).toBeNull();
    expect(coerce({ type: 'text', options: [] }, ['x', 'y'])).toBe('x, y');
  });
});

describe('what roles open', () => {
  test('routing to a role, also inside expressions', () => {
    expect(stepRoleKeys({ assignTo: { role: 'reviewer' }, escalateTo: { role: 'senior_reviewer' } })).toEqual([{ key: 'reviewer', how: 'queue' }, { key: 'senior_reviewer', how: 'escalation' }]);
    expect(stepRoleKeys({ assignTo: { role: "= $number(input.amount) > 50000 ? 'senior_reviewer' : 'reviewer'" } }).map((r) => r.key)).toEqual(['senior_reviewer', 'reviewer']);
  });
});

describe('effective dates', () => {
  test('now or the past means at once; too far or nonsense is refused', () => {
    expect(parseEffectiveAt(undefined)).toBeNull();
    expect(parseEffectiveAt(new Date(Date.now() - 60_000).toISOString())).toBeNull();
    expect(parseEffectiveAt(new Date(Date.now() + 3600_000).toISOString())).toBeInstanceOf(Date);
    expect(() => parseEffectiveAt('tomorrow-ish')).toThrow();
    expect(() => parseEffectiveAt(new Date(Date.now() + 900 * 24 * 3600_000).toISOString())).toThrow();
  });
});
