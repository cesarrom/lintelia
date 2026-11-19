import { useState } from 'react';
import type { PermissionDefinition } from '@repo/fintivio/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EffectiveDate } from '@/components/access/EffectiveDate';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation } from '@/lib/services/api';
import { announceChange } from '@/lib/access';

export interface RoleView {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  customPermissions: string[];
  isSystem: boolean;
  members: number;
  privileged: boolean;
}

export type CatalogEntry = PermissionDefinition & { custom?: boolean; archived?: boolean };

export const groupByCategory = (catalog: CatalogEntry[]) => catalog.reduce<Record<string, CatalogEntry[]>>((acc, p) => {
  (acc[p.category] ??= []).push(p);
  return acc;
}, {});

/**
 * Create or edit a custom role (name, description, permissions — built-in and custom — never more than you hold), or
 * extend a system role with custom permissions (its platform permissions stay). Changes that grant something may wait
 * for a second administrator or a date (docs/plans/15 §14).
 */
export function RoleDialog({ role, catalog, open, onOpenChange }: { role: RoleView | null; catalog: CatalogEntry[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { permissions: mine } = useAuth();
  const extend = !!role?.isSystem;
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(extend ? role!.customPermissions : role?.permissions ?? []);
  const [effectiveAt, setEffectiveAt] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const save = useApiMutation<void, unknown>(({ axios, url }) => {
    if (!role) return axios.post(url('/roles'), { name, description, permissions, effectiveAt });
    if (extend) return axios.put(url(`/roles/${role.key}`), { customPermissions: permissions, effectiveAt });
    return axios.put(url(`/roles/${role.key}`), { name, description, permissions, effectiveAt });
  }, [['roles'], ['access-changes'], ['permissions'], ['auth', 'me']]);

  const active = catalog.filter((p) => !p.archived);
  const shown = extend ? active.filter((p) => p.custom) : active;
  const toggle = (id: string, checked: boolean) => setPermissions((current) => checked ? [...new Set([...current, id])] : current.filter((p) => p !== id));

  const submit = async () => {
    setError(null);
    try {
      const result = await save.mutateAsync();
      announceChange(result, role ? 'Role updated' : 'Role created');
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{extend ? `Extend ${role!.name}` : role ? `Edit ${role.name}` : 'New custom role'}</DialogTitle>
          <DialogDescription>
            {extend
              ? "Add your institution's own permissions to this system role. Its platform permissions stay as they are and keep evolving with Fintivio."
              : 'You can only grant permissions you hold yourself.'}
          </DialogDescription>
        </DialogHeader>
        {!extend && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom permissions yet: create one in the Custom permissions tab.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(groupByCategory(shown)).map(([category, items]) => (
              <fieldset key={category} className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-semibold">{category}</legend>
                {items.map((p) => {
                  const grantable = mine.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-start gap-2 text-sm" title={grantable ? p.description : 'You do not hold this permission'}>
                      <Checkbox aria-label={p.name} checked={permissions.includes(p.id)} disabled={!grantable} onCheckedChange={(checked) => toggle(p.id, checked === true)} />
                      <span className={grantable ? '' : 'text-muted-foreground'}>
                        {p.name}{p.custom && <span className="ml-1 rounded bg-primary-soft px-1 text-[10px] font-medium text-primary">custom</span>}
                        <span className="block text-xs text-muted-foreground">{p.description}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ))}
          </div>
        )}
        <EffectiveDate value={effectiveAt} onChange={setEffectiveAt} />
        {error && <Alert variant="destructive"><AlertDescription data-testid="role-error">{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={(!extend && !name.trim()) || save.isPending}>{extend ? 'Save extension' : role ? 'Save role' : 'Create role'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
