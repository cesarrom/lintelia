import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Role } from '@repo/fintivio/schemas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer, PageHeader, StatusBadge } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface Member {
  id: string;
  email: string;
  name: string;
  roles: string[];
  kind: 'member' | 'client';
  status: 'active' | 'inactive';
}

/** The institution's team: invite members with a role, change roles, deactivate (which signs them out everywhere). */
export default function UsersPage() {
  const { user, tenant, hasPermission } = useAuth();
  const { data: people = [], isLoading } = useApiQuery<Member[]>(['users'], '/users');
  const { data: roles = [] } = useApiQuery<Role[]>(['roles', 'getRoles'], '/roles', { enabled: hasPermission('roles:read') || hasPermission('members:invite') });
  const roleName = (key: string) => roles.find((r) => r.id === key)?.name ?? key;
  const members = people.filter((p) => p.kind !== 'client');

  const invite = useApiMutation<{ email: string; name: string; roleIds: string[] }>(({ axios, url }, body) => axios.post(url('/users'), body), [['users']]);
  const setRoles = useApiMutation<{ userId: string; roleIds: string[] }>(({ axios, url }, { userId, roleIds }) => axios.put(url(`/users/${userId}`), { roleIds }), [['users']]);
  const setStatus = useApiMutation<{ userId: string; action: 'activate' | 'deactivate' | 'reset-password' }>(
    ({ axios, url }, { userId, action }) => axios.patch(url(`/users/${userId}/${action}`)), [['users']],
  );

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onInvite = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await invite.mutateAsync({ email, name, roleIds: role ? [role] : [] });
      setEmail('');
      setName('');
    }, `Invitation sent to ${email}`);
  };

  return (
    <PageContainer>
      <PageHeader title="Team" description={`Members of ${tenant?.name ?? 'your institution'} and their roles`} />

      {hasPermission('members:invite') && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
            <CardDescription>They receive an e-mail with a link to choose a password. You can only give roles within your own permissions.</CardDescription>
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
                  <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={invite.isPending || !role}>Send invitation</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border">
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
              return (
                <TableRow key={member.id} data-testid="member-row" data-email={member.email}>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>
                    {hasPermission('members:update') && !self ? (
                      <Select value={member.roles[0] ?? ''} onValueChange={(value) => void run(() => setRoles.mutateAsync({ userId: member.id, roleIds: [value] }), 'Role changed')}>
                        <SelectTrigger className="w-56" aria-label={`Role of ${member.email}`}><SelectValue placeholder="No role" /></SelectTrigger>
                        <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : member.roles.map(roleName).join(', ') || '—'}
                  </TableCell>
                  <TableCell><StatusBadge status={member.status === 'active' ? 'active' : 'suspended'} label={member.status === 'active' ? 'Active' : 'Deactivated'} /></TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
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
    </PageContainer>
  );
}
