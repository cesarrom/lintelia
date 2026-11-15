import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAxios } from '@/lib/services/axios';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

interface MyDataRequest {
  id: string;
  type: 'export' | 'erasure';
  status: 'open' | 'completed' | 'rejected';
  resolution: string | null;
  requestedAt: string;
  completedAt: string | null;
  hasExport: boolean;
}

/** Data rights: ask for a copy of my data or its erasure, and follow the requests. */
export default function PortalPrivacyPage() {
  const { tenant } = useAuth();
  const { axios } = useAxios();
  const { data: requests = [] } = useApiQuery<MyDataRequest[]>(['portal', 'data-requests'], '/me/data-requests', { refetchInterval: 5000 });
  const file = useApiMutation<'export' | 'erasure'>(({ axios, url }, type) => axios.post(url('/me/data-requests'), { type }), [['portal', 'data-requests']]);

  const request = async (type: 'export' | 'erasure') => {
    if (type === 'erasure' && !window.confirm('Erase your personal data? You will lose access to your portal.')) return;
    try {
      await file.mutateAsync(type);
      toast.success(type === 'export' ? 'We received your request for a copy of your data' : 'We received your erasure request');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const download = async (id: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/me/data-requests/${id}/export`);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' }));
      link.download = 'my-data.json';
      link.click();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Privacy</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>{tenant?.name ?? 'The institution'} answers requests about your personal data within one month.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => request('export')} disabled={file.isPending}>Request a copy of my data</Button>
          <Button variant="outline" onClick={() => request('erasure')} disabled={file.isPending}>Erase my data</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id} data-testid="data-request" data-type={r.type}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{r.type === 'export' ? 'Copy of my data' : 'Erasure of my data'}</p>
                <p className="text-xs text-muted-foreground">Requested {formatDate(r.requestedAt)}{r.completedAt && ` · answered ${formatDate(r.completedAt)}`}</p>
                {r.resolution && <p className="mt-1 text-sm">{r.resolution}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} label={r.status === 'open' ? 'In progress' : r.status === 'completed' ? 'Done' : 'Declined'} />
                {r.hasExport && <Button size="sm" variant="outline" onClick={() => download(r.id)}><Download className="mr-2 h-4 w-4" />Download</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
