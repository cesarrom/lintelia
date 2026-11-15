import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface DataRequest {
  id: string;
  type: 'export' | 'erasure';
  status: 'open' | 'completed' | 'rejected';
  resolution: string | null;
  requestedAt: string;
  completedAt: string | null;
  completedBy: string | null;
  client: { id: string; email: string; name: string | null };
}

/** Clients' data-rights requests (copy / erasure), handled by compliance. */
export default function DataRequestsPage() {
  const { data: requests = [], isLoading } = useApiQuery<DataRequest[]>(['data-requests'], '/data-requests', { refetchInterval: 5000 });
  const complete = useApiMutation<string, DataRequest>(({ axios, url }, id) => axios.post(url(`/data-requests/${id}/complete`)), [['data-requests']]);

  const onComplete = async (request: DataRequest) => {
    try {
      const result = await complete.mutateAsync(request.id);
      toast.success(result.status === 'rejected' ? 'Erasure declined: records are under legal retention' : 'Request completed — the client was notified');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Data requests" description="Clients asking for a copy of their data or its erasure. Answer within one month." />
      {!isLoading && requests.length === 0 ? <EmptyState>No requests.</EmptyState> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Client</TableHead><TableHead>Request</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} data-testid="data-request-row" data-email={r.client.email}>
                  <TableCell>{r.client.name} <span className="text-xs text-muted-foreground">{r.client.email}</span></TableCell>
                  <TableCell>{r.type === 'export' ? 'Copy of data' : 'Erasure'}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.requestedAt)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /> {r.completedBy && <span className="text-xs text-muted-foreground">by {r.completedBy}</span>}</TableCell>
                  <TableCell className="text-right">
                    {r.status === 'open' && <Button size="sm" onClick={() => onComplete(r)} disabled={complete.isPending}>{r.type === 'export' ? 'Prepare export' : 'Process erasure'}</Button>}
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
