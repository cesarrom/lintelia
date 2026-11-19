import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { announceChange } from '@/lib/access';
import { SourceBadge } from '../roles/RolePage';
import { AttributeDefinitionsDialog, MemberAccessDialog, MemberRolesDialog, type Member, type RoleOption } from './MemberAccess';

/**
 * The institution's team: invite members with a role, change roles (several, time-bound, from a date), deactivate
 * (which signs them out everywhere), see what each member can access. Members whose roles come from the identity
 * provider are read-only here (docs/plans/15).
 */
export default function UsersPage() {
  const { user, tenant, hasPermission } = useAuth();
  const { data: people = [], isLoading } = useApiQuery<Member[]>(['users'], '/users');
  const { data: roles = [] } = useApiQuery<RoleOption[]>(['roles', 'getRoles'], '/roles', { enabled: hasPermission('roles:read') || hasPermission('members:invite') });
  const roleName = (key: string) => roles.find((r) => (r.key ?? r.id) === key)?.name ?? key;
  const members = people.filter((p) => p.kind !== 'client');

  const invite = useApiMutation<{ email: string; name: string; roleIds: string[] }, unknown>(({ axios, url }, body) => axios.post(url('/users'), body), [['users'], ['access-changes'], ['auth', 'me']]);
  const setRoles = useApiMutation<{ userId: string; roleIds: string[] }, unknown>(({ axios, url }, { userId, roleIds }) => axios.put(url(`/users/${userId}`), { roleIds }), [['users'], ['access-changes'], ['auth', 'me']]);
  const setStatus = useApiMutation<{ userId: string; action: 'activate' | 'deactivate' | 'reset-password' }>(
    ({ axios, url }, { userId, action }) => axios.patch(url(`/users/${userId}/${action}`)), [['users'], ['auth', 'me']],
  );

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<Member | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [attributes, setAttributes] = useState(false);
  const canSeeAccess = hasPermission('roles:read') && hasPermission('members:read');

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      announceChange(await action(), success);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onInvite = (event: FormEvent) => {
    event.preventDefault();
    const to = email;
    void run(async () => {
      const result = await invite.mutateAsync({ email: to, name, roleIds: role ? [role] : [] });
      setEmail('');
      setName('');
      return result;
    }, `Invitation sent to ${to}`);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Team"
        description={`Members of ${tenant?.name ?? 'your institution'}, their roles and where each role comes from`}
        actions={hasPermission('members:update') && <Button variant="outline" onClick={() => setAttributes(true)}><Tags className="mr-2 h-4 w-4" />Member attributes</Button>}
      />

      {hasPermission('members:invite') && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>They receive an e-mail with a link to choose a password. You can only give roles within your own permissions. Once single sign-on is linked, people of your SSO domains get their roles from their identity provider's groups.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-4 items-end" onSubmit={onInvite}>
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name</Label>
                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger aria-label="Role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>{roles.map((r) => <SelectItem key={r.key ?? r.id} value={r.key ?? r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={invite.isPending || !role}>Send invitation</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>}
            {members.map((member) => {
              const self = member.id === user?.userId;
              const editable = hasPermission('members:update') && !self && !member.managedByIdp;
              const assignments = member.assignments ?? member.roles.map((r) => ({ role: r, source: 'manual', groups: [], expiresAt: null }));
              const simple = member.roles.length <= 1 && assignments.every((a) => a.source === 'manual' && !a.expiresAt);
              return (
                <TableRow key={member.id} data-testid="member-row" data-email={member.email} data-managed={member.managedByIdp ? 'idp' : 'manual'}>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>
                    {editable && simple ? (
                      <div className="flex items-center gap-2">
                        <Select value={member.roles[0] ?? ''} onValueChange={(value) => void run(() => setRoles.mutateAsync({ userId: member.id, roleIds: [value] }), 'Role changed')}>
                          <SelectTrigger className="w-56" aria-label={`Role of ${member.email}`}><SelectValue placeholder="No role" /></SelectTrigger>
                          <SelectContent>{roles.map((r) => <SelectItem key={r.key ?? r.id} value={r.key ?? r.id}>{r.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(member)}>More…</Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {assignments.length === 0 && <span className="text-muted-foreground">—</span>}
                        {assignments.map((a) => (
                          <span key={a.role} className="inline-flex items-center gap-1 text-sm" data-role={a.role}>
                            {roleName(a.role)}
                            {a.source !== 'manual' && <SourceBadge source={a.source} groups={a.groups} />}
                            {a.expiresAt && <span className="text-xs text-muted-foreground">until {formatDate(a.expiresAt)}</span>}
                          </span>
                        ))}
                        {member.managedByIdp && <span className="text-xs text-muted-foreground" title="Roles of this member come from your identity provider's groups">{member.idpPending ? '(from your identity provider at their next sign-in)' : '(from your identity provider)'}</span>}
                        {editable && <Button size="sm" variant="ghost" onClick={() => setEditing(member)}>Edit roles</Button>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={member.status === 'active' ? 'active' : 'suspended'} label={member.status === 'active' ? 'Active' : 'Deactivated'} /></TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {canSeeAccess && <Button size="sm" variant="ghost" onClick={() => setInspecting(member.id)}>Access</Button>}
                    {hasPermission('members:deactivate') && !self && (member.status === 'active'
                      ? <Button size="sm" variant="outline" onClick={() => void run(() => setStatus.mutateAsync({ userId: member.id, action: 'deactivate' }), `${member.email} deactivated`)}>Deactivate</Button>
                      : <Button size="sm" variant="outline" onClick={() => void run(() => setStatus.mutateAsync({ userId: member.id, action: 'activate' }), `${member.email} reactivated`)}>Reactivate</Button>)}
                    {hasPermission('members:deactivate') && !self && (
                      <Button size="sm" variant="ghost" onClick={() => void run(() => setStatus.mutateAsync({ userId: member.id, action: 'reset-password' }), 'Password reset link sent')}>Reset password</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {editing && <MemberRolesDialog member={editing} roles={roles} open onOpenChange={(open) => !open && setEditing(null)} />}
      {inspecting && <MemberAccessDialog memberId={inspecting} open onOpenChange={(open) => !open && setInspecting(null)} />}
      {attributes && <AttributeDefinitionsDialog open onOpenChange={setAttributes} />}
    </PageContainer>
  );
}
