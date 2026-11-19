import { Monogram } from '@/components/brand/Monogram';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { Tenant } from '@repo/fintivio/schemas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);

function OnboardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [domainTouched, setDomainTouched] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [country, setCountry] = useState('US');
  const [error, setError] = useState<string | null>(null);
  const create = useApiMutation<Record<string, unknown>, Tenant & { invitations: string[] }>(({ axios, url }, body) => axios.post(url('/tenants'), body), [['platform', 'tenants']]);

  const submit = async () => {
    setError(null);
    try {
      const tenant = await create.mutateAsync({
        name, domain, country, allowedDomains: [],
        invitee: adminEmail ? [{ email: adminEmail, role: 'admin' }] : [],
      });
      toast.success(`${tenant.name} onboarded${tenant.invitations.length ? ` — invitation sent to ${tenant.invitations.join(', ')}` : ''}`);
      setName(''); setDomain(''); setDomainTouched(false); setAdminEmail('');
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onboard an institution</DialogTitle>
          <DialogDescription>Creates the workspace with its system roles and invites its first administrator.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inst-name">Institution name</Label>
            <Input id="inst-name" value={name} onChange={(e) => { setName(e.target.value); if (!domainTouched) setDomain(slugify(e.target.value)); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inst-key">Workspace key</Label>
            <Input id="inst-key" value={domain} onChange={(e) => { setDomainTouched(true); setDomain(e.target.value); }} />
            <p className="text-xs text-muted-foreground">Their workspace address: {domain || 'key'}.localhost:3001 (custom domains can be added later)</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inst-admin">Administrator e-mail</Label>
            <Input id="inst-admin" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inst-country">Country</Label>
            <Input id="inst-country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name || !domain || create.isPending}>Create workspace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Restore an administrator of an institution that locked itself out (docs/plans/15 §14). Only after verifying the
 * request out of band: the ticket is recorded in both audit logs, and the institution's administrators are told.
 */
function RecoverAccessDialog({ tenant, onOpenChange }: { tenant: Tenant; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recover = useApiMutation<void>(({ axios, url }) => axios.post(url(`/platform/tenants/${tenant.domain}/recover-access`), { email, name, reason, ticket }));
  const submit = async () => {
    setError(null);
    try {
      await recover.mutateAsync();
      toast.success(`Invitation sent to ${email} as administrator of ${tenant.name}`);
      onOpenChange(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore access to {tenant.name}</DialogTitle>
          <DialogDescription>
            For institutions locked out of their own workspace (no administrator left, identity provider gone). Verify the request out of band first:
            the person is invited as an administrator with a local account, the ticket goes to both audit logs and every administrator is told.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="recover-email">Administrator's e-mail</Label><Input id="recover-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="recover-name">Name</Label><Input id="recover-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="recover-ticket">Support ticket (where the request was verified)</Label><Input id="recover-ticket" value={ticket} onChange={(e) => setTicket(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="recover-reason">Reason</Label><Input id="recover-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. the only administrator left the bank" /></div>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={recover.isPending || !email || !ticket || reason.trim().length < 10}>Restore access</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Platform console: the institutions (tenants) operated on Fintivio. Staff never see tenant data from here. */
export default function InstitutionsPage() {
  const { hasPermission } = useAuth();
  const { data: tenants = [], isLoading } = useApiQuery<Tenant[]>(['platform', 'tenants'], '/tenants/all');
  const [onboarding, setOnboarding] = useState(false);
  const [recovering, setRecovering] = useState<Tenant | null>(null);
  const setStatus = useApiMutation<{ domain: string; status: 'active' | 'suspended' }>(
    ({ axios, url }, { domain, status }) => axios.put(url(`/tenants/${domain}`), { data: { status } }), [['platform', 'tenants']],
  );

  const toggle = async (tenant: Tenant) => {
    const status = tenant.status === 'active' ? 'suspended' : 'active';
    if (status === 'suspended' && !window.confirm(`Suspend ${tenant.name}? Its members and clients are signed out and cannot sign in until it is reactivated.`)) return;
    try {
      await setStatus.mutateAsync({ domain: tenant.domain, status });
      toast.success(`${tenant.name} ${status === 'active' ? 'reactivated' : 'suspended'}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Institutions"
        description="Financial institutions operating on the platform"
        actions={hasPermission('platform.tenants:create') && <Button onClick={() => setOnboarding(true)}><Plus className="h-4 w-4" />Onboard institution</Button>}
      />
      {!isLoading && tenants.length === 0 ? <EmptyState art="clients">No institutions yet.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Workspace key</TableHead><TableHead>Custom domains</TableHead><TableHead>Status</TableHead><TableHead>Since</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id} data-testid="institution-row" data-domain={t.domain}>
                  <TableCell className="font-medium"><span className="flex items-center gap-3"><Monogram name={t.name} color={(t as { pallette?: { primary?: string } }).pallette?.primary} size="sm" />{t.name}</span></TableCell>
                  <TableCell className="font-mono text-xs">{t.domain}</TableCell>
                  <TableCell className="text-sm">{t.allowedDomains.join(', ') || '—'}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-sm">{formatDate(t.createdAt as any)}</TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap text-right">
                    {hasPermission('platform.tenants:recover') && t.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => setRecovering(t)}>Restore access</Button>
                    )}
                    {hasPermission('platform.tenants:update') && (
                      <Button size="sm" variant={t.status === 'active' ? 'outline' : 'default'} onClick={() => toggle(t)} disabled={setStatus.isPending}>
                        {t.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <OnboardDialog open={onboarding} onOpenChange={setOnboarding} />
      {recovering && <RecoverAccessDialog tenant={recovering} onOpenChange={(open) => !open && setRecovering(null)} />}
    </PageContainer>
  );
}
