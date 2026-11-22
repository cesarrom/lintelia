import { useId, useMemo, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApiQuery } from '@/lib/services/api';
import { PermissionDialog } from '@/app/modules/private/roles/PermissionDialog';
import type { CatalogEntry } from '@/app/modules/private/roles/RoleDialog';

export interface AccessRule { permissions?: string[]; roles?: string[]; when?: string }

const empty = (rule: AccessRule) => !rule.permissions?.length && !rule.roles?.length && !rule.when?.trim();

/**
 * Edit an access rule (docs/plans/15 §5.2): the default, or members holding **all** the chosen permissions (built-in or
 * the institution's own), holding **one of** the chosen roles, and for whom an optional condition holds. The
 * recommended form is a permission: who holds it is then decided on the Roles page, by administrators.
 */
export function AccessRuleEditor({ label, defaultLabel, value, onChange, testId, compact }: {
  label: string;
  defaultLabel: string;
  value: AccessRule | undefined;
  onChange: (value: AccessRule | undefined) => void;
  testId?: string;
  /** One column (narrow panels such as the studio's inspector). */
  compact?: boolean;
}) {
  const id = useId();
  const { hasPermission } = useAuth();
  const { data: catalog = [] } = useApiQuery<CatalogEntry[]>(['permissions'], '/permissions');
  const { data: roles = [] } = useApiQuery<Array<{ key: string; name: string }>>(['roles', 'getRoles'], hasPermission('roles:read') ? '/roles' : null);
  // Restricted as soon as the rule says something, or when the person chose it (before picking anything).
  const [chosen, setChosen] = useState(false);
  const restricted = chosen || (!!value && !empty(value));
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const rule = value ?? {};
  const set = (change: Partial<AccessRule>) => {
    const next = { ...rule, ...change };
    const clean: AccessRule = {
      ...(next.permissions?.length ? { permissions: next.permissions } : {}),
      ...(next.roles?.length ? { roles: next.roles } : {}),
      ...(next.when?.trim() ? { when: next.when } : {}),
    };
    onChange(empty(clean) ? undefined : clean);
  };
  const term = filter.trim().toLowerCase();
  const permissions = useMemo(() => [...catalog.filter((p) => p.custom && !p.archived), ...catalog.filter((p) => !p.custom)]
    .filter((p) => !term || p.name.toLowerCase().includes(term) || p.id.includes(term)), [catalog, term]);
  const toggle = (list: string[] | undefined, item: string, on: boolean) => (on ? [...new Set([...(list ?? []), item])] : (list ?? []).filter((x) => x !== item));

  return (
    <fieldset className={compact ? "space-y-2 rounded-xl border p-3" : "space-y-2 rounded-xl border p-4"} data-testid={testId}>
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" name={id} checked={!restricted} onChange={() => { setChosen(false); onChange(undefined); }} />{defaultLabel}</label>
        <label className="flex items-center gap-1.5"><input type="radio" name={id} checked={restricted} onChange={() => setChosen(true)} />Only some members</label>
      </div>
      {restricted && (
        <div className={compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Holding all of these permissions</Label>
              {(hasPermission('roles:manage') || hasPermission('workflows:manage')) && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(true)}><KeyRound className="mr-1 h-3.5 w-3.5" />New permission</Button>
              )}
            </div>
            <Input aria-label={`${label}: filter permissions`} placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8" />
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
              {permissions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm" title={p.description}>
                  <Checkbox aria-label={`${label}: ${p.name}`} checked={!!rule.permissions?.includes(p.id)} onCheckedChange={(c) => set({ permissions: toggle(rule.permissions, p.id, c === true) })} />
                  <span>{p.name}{p.custom && <span className="ml-1 rounded bg-primary-soft px-1 text-[10px] font-medium text-primary">custom</span>}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>In one of these roles (optional)</Label>
            <div className="max-h-[13.5rem] space-y-1 overflow-y-auto rounded-md border p-2">
              {roles.map((r) => (
                <label key={r.key} className="flex items-center gap-2 text-sm">
                  <Checkbox aria-label={`${label}: role ${r.name}`} checked={!!rule.roles?.includes(r.key)} onCheckedChange={(c) => set({ roles: toggle(rule.roles, r.key, c === true) })} />
                  {r.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Prefer a permission: administrators then decide who holds it on the Roles page.</p>
          </div>
          <div className={compact ? 'space-y-1.5' : 'space-y-1.5 md:col-span-2'}>
            <Label htmlFor={`${id}-when`}>And when (optional condition)</Label>
            <Input id={`${id}-when`} className="font-mono text-xs" placeholder="e.g. member.attributes.region = 'EU'" value={rule.when ?? ''} onChange={(e) => set({ when: e.target.value })} />
          </div>
        </div>
      )}
      {creating && <PermissionDialog permission={null} open onOpenChange={setCreating} onCreated={(p) => set({ permissions: toggle(rule.permissions, p.id, true) })} />}
    </fieldset>
  );
}
