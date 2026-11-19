import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageContainer, PageHeader, SectionHeader, StatusBadge, TableCard, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApiQuery } from '@/lib/services/api';
import { SOURCE_LABEL } from '@/lib/access';
import { RoleDialog, groupByCategory, type CatalogEntry, type RoleView } from './RoleDialog';

interface Member { userId: string; email: string; name: string; status: string; source: string; groups: string[]; expiresAt: string | null; grantedBy: string | null; since: string }
interface Usage {
  permissions: string[];
  groups: string[];
  justInTimeDefault: boolean;
  workflows: Array<{ id: string; name: string; version: number; queues: string[]; escalations: string[]; start: 'yes' | 'no' | 'conditional'; cases: 'yes' | 'no' | 'conditional'; gated: boolean }>;
}

export function SourceBadge({ source, groups }: { source: string; groups?: string[] }) {
  const label = source === 'idp' ? `IdP${groups?.length ? `: ${groups.join(', ')}` : ''}` : source === 'default' ? 'Default' : source === 'recovery' ? 'Recovery' : 'Manual';
  return <Badge variant={source === 'manual' ? 'outline' : 'secondary'} className="font-normal" title={SOURCE_LABEL[source] ?? source} data-source={source}>{label}</Badge>;
}

const VERDICT: Record<string, string> = { yes: 'Yes', no: 'No', conditional: 'Depends on the member' };

/** One role: its permissions, who holds it (and how), and what it opens (docs/plans/15 §6). */
export default function RolePage() {
  const { roleKey = '' } = useParams();
  const { hasPermission } = useAuth();
  const { data: role } = useApiQuery<RoleView>(['roles', roleKey], `/roles/${roleKey}`);
  const { data: catalog = [] } = useApiQuery<CatalogEntry[]>(['permissions'], '/permissions');
  const { data: members = [] } = useApiQuery<Member[]>(['roles', roleKey, 'members'], hasPermission('members:read') ? `/roles/${roleKey}/members` : null);
  const { data: usage } = useApiQuery<Usage>(['roles', roleKey, 'usage'], `/roles/${roleKey}/usage`);
  const [editing, setEditing] = useState(false);
  const held = useMemo(() => catalog.filter((p) => role?.permissions.includes(p.id)), [catalog, role]);

  if (!role) return <PageContainer><p className="text-sm text-muted-foreground">Loading…</p></PageContainer>;
  const canManage = hasPermission('roles:manage') && role.key !== 'admin';

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link to="/app/roles" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Roles</Link>}
        title={<span data-testid="role-title">{role.name} {role.isSystem && <Badge variant="secondary" className="ml-1 align-middle">System</Badge>}</span>}
        description={role.description}
        actions={canManage && <Button variant="outline" onClick={() => setEditing(true)}>{role.isSystem ? 'Extend' : 'Edit'}</Button>}
      />
      {role.privileged && (
        <p className="flex items-center gap-2 text-sm text-[hsl(30_85%_34%)]"><ShieldAlert className="h-4 w-4" />This role administers access (members, roles, security or API clients): changes to it are told to every administrator.</p>
      )}

      <section className="space-y-3">
        <SectionHeader title="Permissions" description={role.isSystem ? "The platform's permissions of this role, plus your institution's own (highlighted)." : undefined} />
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(groupByCategory(held)).map(([category, items]) => (
            <div key={category} className="rounded-lg border p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
              <ul className="space-y-1 text-sm">
                {items.map((p) => <li key={p.id} className={p.custom ? 'text-primary' : ''} title={p.description} data-permission={p.id}>{p.name}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {hasPermission('members:read') && (
        <section className="space-y-3">
          <SectionHeader title={`Members (${members.length})`} description="Who holds the role now, and how they got it." />
          {members.length === 0 ? <EmptyState>Nobody holds this role.</EmptyState> : (
            <TableCard>
              <Table>
                <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>How</TableHead><TableHead>Since</TableHead><TableHead>Until</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.userId} data-testid="role-member" data-email={m.email}>
                      <TableCell><p className="font-medium">{m.email}</p><p className="text-xs text-muted-foreground">{m.name}</p></TableCell>
                      <TableCell><SourceBadge source={m.source} groups={m.groups} />{m.grantedBy && m.source === 'manual' && <span className="ml-2 text-xs text-muted-foreground">by {m.grantedBy}</span>}</TableCell>
                      <TableCell className="text-sm">{formatDate(m.since)}</TableCell>
                      <TableCell className="text-sm">{m.expiresAt ? formatDate(m.expiresAt) : '—'}</TableCell>
                      <TableCell><StatusBadge status={m.status === 'active' ? 'active' : 'inactive'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </section>
      )}

      <section className="space-y-3" data-testid="role-opens">
        <SectionHeader title="What it opens" description="Work routed to the role and the workflows its holders may start, from the published workflows." />
        {usage && (usage.groups.length > 0 || usage.justInTimeDefault) && (
          <p className="text-sm">
            {usage.groups.length > 0 && <>Given by your identity provider's groups: <strong>{usage.groups.join(', ')}</strong>. </>}
            {usage.justInTimeDefault && 'Default role of people who join through single sign-on.'}
          </p>
        )}
        {!usage?.workflows.length ? <EmptyState>No published workflow routes work to this role or lets it start anything.</EmptyState> : (
          <TableCard>
            <Table>
              <TableHeader><TableRow><TableHead>Workflow</TableHead><TableHead>Queue (tasks)</TableHead><TableHead>Escalations</TableHead><TableHead>May start it</TableHead><TableHead>Sees its cases</TableHead></TableRow></TableHeader>
              <TableBody>
                {usage.workflows.map((w) => (
                  <TableRow key={w.id} data-testid="role-workflow" data-workflow={w.name}>
                    <TableCell><Link to={`/app/workflows/${w.id}`} className="font-medium hover:underline">{w.name}</Link> <span className="text-xs text-muted-foreground">v{w.version}</span>{w.gated && <Badge variant="outline" className="ml-2 font-normal">access rules</Badge>}</TableCell>
                    <TableCell className="text-sm">{w.queues.join(', ') || '—'}</TableCell>
                    <TableCell className="text-sm">{w.escalations.join(', ') || '—'}</TableCell>
                    <TableCell className="text-sm">{VERDICT[w.start]}</TableCell>
                    <TableCell className="text-sm">{w.cases === 'yes' ? 'Within case scope' : VERDICT[w.cases]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </section>
      {editing && <RoleDialog role={role} catalog={catalog} open onOpenChange={setEditing} />}
    </PageContainer>
  );
}

interface Who {
  permission: CatalogEntry;
  roles: Array<{ key: string; name: string; isSystem: boolean; members: number }>;
  members: Array<{ userId: string; email: string; name: string; via: Array<{ role: string; source: string }> }>;
  apiClients: Array<{ id: string; name: string }>;
  workflows: Array<{ id: string; name: string; start: boolean; cases: boolean }>;
}

/** Who holds a permission: roles, members through them, API clients; and which workflows require it. */
export function WhoPage() {
  const [params] = useSearchParams();
  const permission = params.get('permission') ?? '';
  const { data: catalog = [] } = useApiQuery<CatalogEntry[]>(['permissions'], '/permissions');
  const { data } = useApiQuery<Who>(['access', 'who', permission], permission ? `/access/who?permission=${encodeURIComponent(permission)}` : null);
  const [, setSearch] = useSearchParams();
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link to="/app/roles" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Roles</Link>}
        title="Who can…" description="Pick a permission: who holds it, through which role, and where it is required." />
      <select aria-label="Permission" className="h-9 w-full max-w-md rounded-md border bg-background px-2 text-sm" value={permission}
        onChange={(e) => setSearch({ permission: e.target.value })}>
        <option value="">Choose a permission…</option>
        {Object.entries(groupByCategory(catalog)).map(([category, items]) => (
          <optgroup key={category} label={category}>{items.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}</optgroup>
        ))}
      </select>
      {data && (
        <div className="grid gap-6 lg:grid-cols-2" data-testid="who-can">
          <section className="space-y-2">
            <SectionHeader title={`Roles (${data.roles.length})`} />
            <ul className="space-y-1 text-sm">{data.roles.map((r) => <li key={r.key}><Link to={`/app/roles/${r.key}`} className="font-medium hover:underline">{r.name}</Link> <span className="text-muted-foreground">· {r.members} member(s)</span></li>)}</ul>
          </section>
          <section className="space-y-2">
            <SectionHeader title={`Members (${data.members.length})`} />
            <ul className="space-y-1 text-sm" data-testid="who-members">{data.members.map((m) => <li key={m.userId}>{m.email} <span className="text-muted-foreground">· via {m.via.map((v) => v.role).join(', ')}</span></li>)}</ul>
          </section>
          <section className="space-y-2">
            <SectionHeader title={`API clients (${data.apiClients.length})`} />
            <ul className="space-y-1 text-sm">{data.apiClients.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
          </section>
          <section className="space-y-2">
            <SectionHeader title={`Required by workflows (${data.workflows.length})`} />
            <ul className="space-y-1 text-sm">{data.workflows.map((w) => <li key={w.id}><Link to={`/app/workflows/${w.id}`} className="hover:underline">{w.name}</Link> <span className="text-muted-foreground">· {[w.start && 'to start it', w.cases && 'to see its cases'].filter(Boolean).join(', ')}</span></li>)}</ul>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
