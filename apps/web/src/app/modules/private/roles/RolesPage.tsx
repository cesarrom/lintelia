import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Check, Clock, Download, KeyRound, Plus, ShieldAlert, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageContainer, PageHeader, StatusBadge, TableCard } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { announceChange, type AccessChange } from '@/lib/access';
import { RoleDialog, groupByCategory, type CatalogEntry, type RoleView } from './RoleDialog';
import { PermissionDialog } from './PermissionDialog';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Download the CSV of every assignment (access reviews); the export is audited. */
function useExport() {
  const { axios } = useAxios();
  return async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/access/export`, { responseType: 'blob' });
      const href = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `access-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
}

/** Roles × permissions: one place to answer "who can do what". */
function RoleMatrix() {
  const { data } = useApiQuery<{ permissions: CatalogEntry[]; roles: Array<{ key: string; name: string; isSystem: boolean; permissions: string[] }> }>(['access', 'matrix'], '/access/matrix');
  const [filter, setFilter] = useState('');
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const term = filter.trim().toLowerCase();
  const permissions = data.permissions.filter((p) => !term || p.name.toLowerCase().includes(term) || p.id.includes(term) || p.category.toLowerCase().includes(term));
  return (
    <div className="space-y-3">
      <Input aria-label="Filter permissions" placeholder="Filter permissions…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
      <TableCard className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm" data-testid="role-matrix">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">Permission</th>
              {data.roles.map((r) => (
                <th key={r.key} className="px-2 py-2 text-center text-xs font-medium" title={r.key}>
                  <Link to={`/app/roles/${r.key}`} className="hover:underline">{r.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupByCategory(permissions)).map(([category, items]) => [
              <tr key={`c-${category}`} className="bg-muted/20"><td colSpan={data.roles.length + 1} className="sticky left-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</td></tr>,
              ...items.map((p) => (
                <tr key={p.id} className="border-b border-border/50" data-permission={p.id}>
                  <td className="sticky left-0 z-10 bg-card px-3 py-1.5" title={p.description}>
                    {p.name}{p.custom && <span className="ml-1 rounded bg-primary-soft px-1 text-[10px] font-medium text-primary">custom</span>}
                    <span className="block font-mono text-[10.5px] text-muted-foreground">{p.id}</span>
                  </td>
                  {data.roles.map((r) => (
                    <td key={r.key} className="px-2 py-1.5 text-center" data-role={r.key}>
                      {r.permissions.includes(p.id) ? <Check className="mx-auto h-4 w-4 text-primary" aria-label={`${r.name} holds ${p.name}`} /> : <span className="text-muted-foreground/40">·</span>}
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

/** The institution's own permissions: where they are used, edit, archive (revokes everywhere), restore. */
function CustomPermissions({ catalog, roles, canManage }: { catalog: CatalogEntry[]; roles: RoleView[]; canManage: boolean }) {
  const custom = catalog.filter((p) => p.custom);
  const [editing, setEditing] = useState<CatalogEntry | null | undefined>(undefined);
  const archive = useApiMutation<CatalogEntry>(({ axios, url }, p) => p.archived
    ? axios.post(url(`/permissions/custom/${encodeURIComponent(p.id)}/restore`))
    : axios.delete(url(`/permissions/custom/${encodeURIComponent(p.id)}`)), [['permissions'], ['roles'], ['access', 'matrix'], ['auth', 'me']]);
  const onArchive = async (p: CatalogEntry) => {
    if (!p.archived && !window.confirm(`Archive ${p.name}? Every role and API client holding it loses it at once.`)) return;
    try {
      await archive.mutateAsync(p);
      toast.success(p.archived ? `${p.name} restored (held by nobody)` : `${p.name} archived`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  return (
    <div className="space-y-3">
      {custom.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet. Name the capabilities your screens and workflows need (e.g. “Waive fees”), then give them to roles.</p>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Permission</TableHead><TableHead>Category</TableHead><TableHead>Held through</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {custom.map((p) => {
                const holders = roles.filter((r) => r.permissions.includes(p.id));
                return (
                  <TableRow key={p.id} data-testid="custom-permission-row" data-key={p.id}>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    </TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-sm">{holders.map((r) => r.name).join(', ') || <span className="text-muted-foreground">nobody yet</span>}</TableCell>
                    <TableCell><StatusBadge status={p.archived ? 'archived' : 'active'} /></TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap text-right">
                      <Button size="sm" variant="ghost" asChild><Link to={`/app/roles/who?permission=${encodeURIComponent(p.id)}`}>Who holds it</Link></Button>
                      {canManage && <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>}
                      {canManage && <Button size="sm" variant="ghost" onClick={() => onArchive(p)}>{p.archived ? 'Restore' : 'Archive'}</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {editing !== undefined && <PermissionDialog permission={editing} open onOpenChange={(open) => !open && setEditing(undefined)} />}
    </div>
  );
}

/**
 * Roles: system roles (defined by the platform, extendable with the institution's own permissions) and custom roles
 * composed from the catalogue; the roles × permissions matrix; the institution's custom permissions
 * (docs/plans/15 §6).
 */
export default function RolesPage() {
  const { hasPermission } = useAuth();
  const { data: roles = [] } = useApiQuery<RoleView[]>(['roles', 'getRoles'], '/roles');
  const { data: catalog = [] } = useApiQuery<CatalogEntry[]>(['permissions'], '/permissions');
  const { data: open = [] } = useApiQuery<AccessChange[]>(['access-changes', 'open'], '/access-changes?status=pending_approval,scheduled');
  const names = useMemo(() => new Map(catalog.map((p) => [p.id, p.name])), [catalog]);
  const [editing, setEditing] = useState<RoleView | null | undefined>(undefined);
  const [newPermission, setNewPermission] = useState(false);
  const remove = useApiMutation<string, unknown>(({ axios, url }, id) => axios.delete(url(`/roles/${id}`)), [['roles'], ['access-changes'], ['auth', 'me']]);
  const canManage = hasPermission('roles:manage');
  const exportCsv = useExport();

  const onDelete = async (role: RoleView) => {
    if (!window.confirm(`Delete the role ${role.name}?${role.members ? ` ${role.members} member(s) hold it and lose it.` : ''}`)) return;
    try {
      announceChange(await remove.mutateAsync(role.id), 'Role deleted');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const system = roles.filter((r) => r.isSystem);
  const custom = roles.filter((r) => !r.isSystem);
  const roleChanges = open.filter((c) => c.kind.startsWith('role.'));

  const RoleCard = ({ role }: { role: RoleView }) => (
    <Card data-testid="role-card" data-role={role.id}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              <Link to={`/app/roles/${role.key}`} className="hover:underline">{role.name}</Link> {role.isSystem && <Badge variant="secondary" className="ml-1">System</Badge>}
            </CardTitle>
            <CardDescription>{role.description}</CardDescription>
            <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1" data-testid="role-members"><Users className="h-3.5 w-3.5" />{role.members} member{role.members === 1 ? '' : 's'}</span>
              <span>{role.permissions.length} permissions</span>
              {role.privileged && <span className="inline-flex items-center gap-1 text-[hsl(30_85%_34%)]"><ShieldAlert className="h-3.5 w-3.5" />Administers access</span>}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-1">
              {role.isSystem
                ? role.key !== 'admin' && <Button size="sm" variant="outline" onClick={() => setEditing(role)}>Extend</Button>
                : <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(role)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(role)}>Delete</Button>
                </>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1">
        {role.permissions.map((p) => (
          <Badge key={p} variant="outline" className={role.customPermissions.includes(p) ? 'border-primary/40 font-normal text-primary' : 'font-normal'}>{names.get(p) ?? p}</Badge>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Roles"
        description="What each role can do, who holds it and what it opens. Workflows route tasks to roles; screens and workflows can require your own permissions."
        actions={<>
          {hasPermission('members:read') && <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export assignments</Button>}
          {(canManage || hasPermission('workflows:manage')) && <Button variant="outline" onClick={() => setNewPermission(true)}><KeyRound className="mr-2 h-4 w-4" />New permission</Button>}
          {canManage && <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />New custom role</Button>}
        </>}
      />
      {roleChanges.length > 0 && (
        <Alert data-testid="pending-role-changes">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {roleChanges.length} role change(s) waiting for approval or their date: {roleChanges.map((c) => c.summary).join('; ')}.{' '}
            <Link to="/app/access-changes" className="font-medium underline">Access changes</Link>
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="matrix">Matrix</TabsTrigger>
          <TabsTrigger value="custom">Custom permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="space-y-6">
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
        </TabsContent>
        <TabsContent value="matrix"><RoleMatrix /></TabsContent>
        <TabsContent value="custom"><CustomPermissions catalog={catalog} roles={roles} canManage={canManage} /></TabsContent>
      </Tabs>
      {editing !== undefined && <RoleDialog role={editing} catalog={catalog} open onOpenChange={(isOpen) => !isOpen && setEditing(undefined)} />}
      {newPermission && <PermissionDialog permission={null} open onOpenChange={setNewPermission} />}
    </PageContainer>
  );
}
