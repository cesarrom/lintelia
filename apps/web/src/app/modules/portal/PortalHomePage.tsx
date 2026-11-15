import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, StatusBadge, formatDate } from '@/components/app/page';
import { useApiQuery } from '@/lib/services/api';
import type { ClientRequest } from './RequestCard';

interface MyCase {
  id: string;
  reference: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const CLIENT_STATUS: Record<string, string> = {
  submitted: 'Received',
  in_progress: 'In progress',
  in_review: 'Under review',
  pending_client: 'Waiting for you',
  approved: 'Approved',
  rejected: 'Not approved',
  closed: 'Closed',
};

export const clientStatus = (status: string) => CLIENT_STATUS[status] ?? status;

/** My applications and anything waiting for me. */
export default function PortalHomePage() {
  const navigate = useNavigate();
  const { data: cases = [], isLoading } = useApiQuery<MyCase[]>(['portal', 'cases'], '/me/cases', { refetchInterval: 5000 });
  const { data: requests = [] } = useApiQuery<ClientRequest[]>(['portal', 'requests'], '/me/requests', { refetchInterval: 5000 });
  const waiting = requests.filter((r) => r.status === 'open');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My applications</h1>
      {waiting.length > 0 && (
        <Alert>
          <AlertDescription>
            {waiting.length === 1 ? 'One request is' : `${waiting.length} requests are`} waiting for you. <button className="underline" onClick={() => navigate('/portal/requests')}>Answer now</button>
          </AlertDescription>
        </Alert>
      )}
      {!isLoading && cases.length === 0 ? <EmptyState>You have no applications yet.</EmptyState> : (
        <div className="space-y-3">
          {cases.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow" onClick={() => navigate(`/portal/cases/${c.id}`)} data-testid="portal-case" data-case-reference={c.reference}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.reference} · submitted {formatDate(c.createdAt)}</p>
                </div>
                <StatusBadge status={c.status} label={clientStatus(c.status)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
