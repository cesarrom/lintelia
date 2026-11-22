import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageContainer, PageHeader, StatusBadge } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface StaffMember { id: string; email: string; name: string; roles: string[]; status: string }
interface PlatformRole { id: string; name: string; description: string; permissions: string[] }

function InviteDialog({ open, onOpenChange, roles }: { open: boolean; onOpenChange: (open: boolean) => void; roles: PlatformRole[] }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const invite = useApiMutation<void>(({ axios, url }) => axios.post(url('/platform/staff'), { email, name, roles: selected }), [['platform', 'staff']]);

  const submit = async () => {
    setError(null);
    try {
      await invite.mutateAsync();
      toast.success(`Invitation sent to ${email}`);
      setEmail(''); setName(''); setSelected([]);
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a staff member</DialogTitle>
          <DialogDescription>They choose a password from the e-mailed link. Platform roles never give access to institution data.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="staff-email">E-mail</Label><Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="staff-name">Name</Label><Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Platform roles</legend>
            {roles.map((r) => (
              <label key={r.id} className="flex items-start gap-2 text-sm">
                <Checkbox aria-label={r.name} checked={selected.includes(r.id)} onCheckedChange={(v) => setSelected((s) => v === true ? [...s, r.id] : s.filter((x) => x !== r.id))} />
                <span>{r.name}<span className="block text-xs text-muted-foreground">{r.description}</span></span>
              </label>
            ))}
          </fieldset>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!email || !selected.length || invite.isPending}>Send invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Platform staff and their platform roles. */
interface StaffSsoStatus { configured: boolean; connections: Array<{ id: string; name: string; state: string }>; domains: Array<{ domain: string; state: string }>; enforce: boolean; ready: boolean }

/** Staff sign in through the company IdP (via the SSO broker); break-glass accounts keep password + TOTP. */
function StaffSso() {
  const { data: sso, refetch } = useApiQuery<StaffSsoStatus>(['platform', 'sso'], '/platform/sso');
  const link = useApiMutation<'sso' | 'domain_verification', { link: string }>(({ axios, url }, intent) => axios.post(url('/platform/sso/setup-link'), { intent }), [['platform', 'sso']]);
  const save = useApiMutation<boolean>(({ axios, url }, enforce) => axios.put(url('/platform/sso/settings'), { enforce }), [['platform', 'sso']]);
  const open = async (intent: 'sso' | 'domain_verification') => {
    try {
      window.open((await link.mutateAsync(intent)).link, '_blank', 'noopener');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  return (
    <div className="mt-8 rounded-md border p-4 space-y-3 text-sm" data-testid="staff-sso">
      <h2 className="text-base font-semibold">Company single sign-on</h2>
      <p className="text-muted-foreground">Staff sign in with the company identity provider. Accounts are still created by invitation only.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => open('sso')}>Configure the identity provider</Button>
        <Button variant="outline" size="sm" onClick={() => open('domain_verification')}>Verify domains</Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>Refresh</Button>
      </div>
      {sso?.configured && (
        <>
          <p>Connections: {sso.connections.map((c) => `${c.name} (${c.state})`).join(', ') || 'none'} · Domains: {sso.domains.map((d) => `${d.domain} (${d.state})`).join(', ') || 'none'}</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sso.enforce} disabled={!sso.ready && !sso.enforce} onChange={(e) => save.mutateAsync(e.target.checked).then(() => toast.success('Saved'), (err) => toast.error(apiErrorMessage(err)))} />
            Refuse staff passwords for verified domains (break-glass accounts excepted)
          </label>
        </>
      )}
    </div>
  );
}

export default function StaffPage() {
  const { user } = useAuth();
  const { data: staff = [] } = useApiQuery<StaffMember[]>(['platform', 'staff'], '/platform/staff');
  const { data: roles = [] } = useApiQuery<PlatformRole[]>(['platform', 'roles'], '/platform/roles');
  const [inviting, setInviting] = useState(false);
  const update = useApiMutation<{ id: string; status: 'active' | 'disabled' }>(({ axios, url }, { id, status }) => axios.put(url(`/platform/staff/${id}`), { status }), [['platform', 'staff']]);

  const toggle = async (member: StaffMember) => {
    try {
      await update.mutateAsync({ id: member.id, status: member.status === 'active' ? 'disabled' : 'active' });
      toast.success(member.status === 'active' ? `${member.email} disabled` : `${member.email} enabled`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Staff" description="People operating the platform" actions={<Button onClick={() => setInviting(true)}><Plus className="h-4 w-4 mr-2" />Invite staff</Button>} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>E-mail</TableHead><TableHead>Name</TableHead><TableHead>Roles</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {staff.map((m) => (
              <TableRow key={m.id} data-testid="staff-row" data-email={m.email}>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell className="space-x-1">{m.roles.map((r) => <Badge key={r} variant="secondary">{roles.find((x) => x.id === r)?.name ?? r}</Badge>)}</TableCell>
                <TableCell><StatusBadge status={m.status === 'disabled' ? 'suspended' : m.status === 'invited' ? 'open' : 'active'} label={m.status === 'invited' ? 'Invited' : m.status === 'disabled' ? 'Disabled' : 'Active'} /></TableCell>
                <TableCell className="text-right">
                  {m.id !== user?.userId && m.status !== 'invited' && (
                    <Button size="sm" variant="outline" onClick={() => toggle(m)}>{m.status === 'active' ? 'Disable' : 'Enable'}</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <StaffSso />
      <InviteDialog open={inviting} onOpenChange={setInviting} roles={roles} />
    </PageContainer>
  );
}
