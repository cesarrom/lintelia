import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { PermissionDefinition, Role } from '@repo/fintivio/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageContainer, PageHeader } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

const groupByCategory = (catalog: PermissionDefinition[]) => catalog.reduce<Record<string, PermissionDefinition[]>>((acc, p) => {
  (acc[p.category] ??= []).push(p);
  return acc;
}, {});

/** Create or edit a custom role: name, description and permissions from the catalogue (never more than you hold). */
function RoleDialog({ role, catalog, open, onOpenChange }: { role: Role | null; catalog: PermissionDefinition[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { permissions: mine } = useAuth();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);
  const save = useApiMutation<void, Role>(({ axios, url }) => role
    ? axios.put(url(`/roles/${role.id}`), { name, description, permissions })
    : axios.post(url('/roles'), { name, description, permissions }), [['roles']]);

  const toggle = (id: string, checked: boolean) => setPermissions((current) => checked ? [...new Set([...current, id])] : current.filter((p) => p !== id));

  const submit = async () => {
    setError(null);
    try {
      await save.mutateAsync();
      toast.success(role ? 'Role updated' : 'Role created');
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? `Edit ${role.name}` : 'New custom role'}</DialogTitle>
          <DialogDescription>You can only grant permissions you hold yourself.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!!role} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groupByCategory(catalog)).map(([category, items]) => (
            <fieldset key={category} className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-semibold">{category}</legend>
              {items.map((p) => {
                const grantable = mine.includes(p.id);
                return (
                  <label key={p.id} className="flex items-start gap-2 text-sm" title={grantable ? p.description : 'You do not hold this permission'}>
                    <Checkbox
                      aria-label={p.name}
                      checked={permissions.includes(p.id)}
                      disabled={!grantable}
                      onCheckedChange={(checked) => toggle(p.id, checked === true)}
                    />
                    <span className={grantable ? '' : 'text-muted-foreground'}>
                      {p.name}
                      <span className="block text-xs text-muted-foreground">{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
        {error && <Alert variant="destructive"><AlertDescription data-testid="role-error">{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || save.isPending}>{role ? 'Save role' : 'Create role'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Roles: system roles (defined by the platform, read-only, evolve with releases) and custom roles the institution
 * composes from the permission catalogue.
 */
export default function RolesPage() {
  const { hasPermission } = useAuth();
  const { data: roles = [] } = useApiQuery<Role[]>(['roles', 'getRoles'], '/roles');
  const { data: catalog = [] } = useApiQuery<PermissionDefinition[]>(['permissions'], '/permissions');
  const names = useMemo(() => new Map(catalog.map((p) => [p.id, p.name])), [catalog]);
  const [editing, setEditing] = useState<Role | null | undefined>(undefined);
  const remove = useApiMutation<string>(({ axios, url }, id) => axios.delete(url(`/roles/${id}`)), [['roles']]);
  const canManage = hasPermission('roles:manage');

  const onDelete = async (role: Role) => {
    if (!window.confirm(`Delete the role ${role.name}?`)) return;
    try {
      await remove.mutateAsync(role.id);
      toast.success('Role deleted');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const system = roles.filter((r) => r.isSystem);
  const custom = roles.filter((r) => !r.isSystem);

  const RoleCard = ({ role }: { role: Role }) => (
    <Card data-testid="role-card" data-role={role.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{role.name} {role.isSystem && <Badge variant="secondary" className="ml-1">System</Badge>}</CardTitle>
            <CardDescription>{role.description}</CardDescription>
          </div>
          {!role.isSystem && canManage && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(role)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(role)}>Delete</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1">
        {role.permissions.map((p) => <Badge key={p} variant="outline" className="font-normal">{names.get(p) ?? p}</Badge>)}
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Roles"
        description="What each role can do. Workflows route tasks to roles; members get roles when invited."
        actions={canManage && <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />New custom role</Button>}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Custom roles</h2>
        {custom.length === 0 ? <p className="text-sm text-muted-foreground">None yet. Compose one from the permission catalogue.</p> : (
          <div className="grid gap-4 md:grid-cols-2">{custom.map((r) => <RoleCard key={r.id} role={r} />)}</div>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">System roles</h2>
        <div className="grid gap-4 md:grid-cols-2">{system.map((r) => <RoleCard key={r.id} role={r} />)}</div>
      </section>
      {editing !== undefined && <RoleDialog role={editing} catalog={catalog} open onOpenChange={(open) => !open && setEditing(undefined)} />}
    </PageContainer>
  );
}
