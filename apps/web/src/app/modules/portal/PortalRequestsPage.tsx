import { EmptyState } from '@/components/app/page';
import { useApiQuery } from '@/lib/services/api';
import { RequestCard, type ClientRequest } from './RequestCard';

/** Every request addressed to me, newest first. */
export default function PortalRequestsPage() {
  const { data: requests = [], isLoading } = useApiQuery<ClientRequest[]>(['portal', 'requests'], '/me/requests', { refetchInterval: 5000 });
  const open = requests.filter((r) => r.status === 'open');
  const past = requests.filter((r) => r.status !== 'open');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">What the team needs from you to move your applications forward.</p>
      </div>
      {!isLoading && requests.length === 0 && <EmptyState art="tasks" title="All caught up">Nothing is waiting for you.</EmptyState>}
      {open.map((r) => <RequestCard key={r.id} request={r} respondPath={`/me/requests/${r.id}/respond`} />)}
      {past.length > 0 && <h2 className="pt-4 text-[15px] font-semibold tracking-tight text-muted-foreground">Answered</h2>}
      {past.map((r) => <RequestCard key={r.id} request={r} respondPath={`/me/requests/${r.id}/respond`} />)}
    </div>
  );
}
