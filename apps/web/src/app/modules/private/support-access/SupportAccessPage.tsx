import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import type { SupportGrant } from '../platform/SupportAccessRequestsPage';

/** Requests from Fintivio support to look at this workspace (read-only, time-bound): approve, deny, revoke. */
export default function SupportAccessPage() {
  const { data: grants = [], isLoading } = useApiQuery<SupportGrant[]>(['support-access'], '/support-access', { refetchInterval: 5000 });
  const act = useApiMutation<{ id: string; action: 'approve' | 'deny' | 'revoke' }>(({ axios, url }, { id, action }) => axios.post(url(`/support-access/${id}/${action}`)), [['support-access']]);

  const run = async (id: string, action: 'approve' | 'deny' | 'revoke') => {
    try {
      await act.mutateAsync({ id, action });
      toast.success({ approve: 'Access granted', deny: 'Request denied', revoke: 'Access revoked' }[action]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Support access" description="Fintivio staff can only look at your workspace with your approval, read-only and for a limited time. Every page they open is in your audit log." />
      {!isLoading && grants.length === 0 ? <EmptyState art="shield">No requests.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Reason</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead>Until</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {grants.map((g) => (
                <TableRow key={g.id} data-testid="support-request-row" data-staff={g.staffEmail}>
                  <TableCell className="text-sm">{g.staffEmail}</TableCell>
                  <TableCell className="text-sm">{g.reason}</TableCell>
                  <TableCell className="text-sm">{g.durationMinutes} min</TableCell>
                  <TableCell><StatusBadge status={g.status === 'pending' ? 'open' : g.status === 'denied' ? 'rejected' : g.status} label={g.status.charAt(0).toUpperCase() + g.status.slice(1)} /></TableCell>
                  <TableCell className="text-sm">{formatDate(g.expiresAt)}</TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {g.status === 'pending' && <Button size="sm" onClick={() => run(g.id, 'approve')}>Approve</Button>}
                    {g.status === 'pending' && <Button size="sm" variant="outline" onClick={() => run(g.id, 'deny')}>Deny</Button>}
                    {g.status === 'active' && <Button size="sm" variant="destructive" onClick={() => run(g.id, 'revoke')}>Revoke</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
