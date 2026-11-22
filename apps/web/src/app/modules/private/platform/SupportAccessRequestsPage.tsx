import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Tenant } from '@repo/lintelia/schemas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

export interface SupportGrant {
  id: string;
  tenant?: string;
  staffEmail: string;
  reason: string;
  durationMinutes: number;
  status: 'pending' | 'active' | 'denied' | 'revoked' | 'expired';
  requestedAt: string;
  decidedBy: string | null;
  expiresAt: string | null;
}

/** Staff ask an institution for time-bound, read-only access (the institution decides). */
export default function SupportAccessRequestsPage() {
  const { data: tenants = [] } = useApiQuery<Tenant[]>(['platform', 'tenants'], '/tenants/all');
  const { data: grants = [] } = useApiQuery<SupportGrant[]>(['platform', 'support-access'], '/platform/support-access', { refetchInterval: 5000 });
  const [tenant, setTenant] = useState('');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('60');
  const request = useApiMutation<void>(({ axios, url }) => axios.post(url('/platform/support-access'), { tenant, reason, scope: 'read', durationMinutes: Number(minutes) }), [['platform', 'support-access']]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request.mutateAsync();
      toast.success('Request sent — the institution must approve it');
      setReason('');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Support access" description="Read-only access to an institution's workspace, only with its approval, for a limited time. Every use is in its audit log." />
      <Card>
        <CardHeader><CardTitle>Request access</CardTitle><CardDescription>At most 8 hours. Writes are always refused.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4 items-end" onSubmit={submit}>
            <div className="space-y-2">
              <Label>Institution</Label>
              <Select value={tenant} onValueChange={setTenant}>
                <SelectTrigger aria-label="Institution"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{tenants.filter((t) => t.status === 'active').map((t) => <SelectItem key={t.id} value={t.domain}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="support-reason">Reason (ticket)</Label><Textarea id="support-reason" rows={1} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="support-minutes">Minutes</Label><Input id="support-minutes" type="number" min={5} max={480} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
            <Button type="submit" disabled={!tenant || !reason.trim() || request.isPending}>Request access</Button>
          </form>
        </CardContent>
      </Card>
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader><TableRow><TableHead>Institution</TableHead><TableHead>Reason</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead>Until</TableHead></TableRow></TableHeader>
          <TableBody>
            {grants.map((g) => (
              <TableRow key={g.id} data-testid="support-grant-row">
                <TableCell className="font-mono text-xs">{g.tenant}</TableCell>
                <TableCell className="text-sm">{g.reason}</TableCell>
                <TableCell className="text-sm">{formatDate(g.requestedAt)}</TableCell>
                <TableCell><StatusBadge status={g.status === 'pending' ? 'open' : g.status === 'denied' ? 'rejected' : g.status} label={g.status.charAt(0).toUpperCase() + g.status.slice(1)} /></TableCell>
                <TableCell className="text-sm">{formatDate(g.expiresAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  );
}
