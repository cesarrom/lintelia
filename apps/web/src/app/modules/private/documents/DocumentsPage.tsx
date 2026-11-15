import { useQuery } from '@tanstack/react-query';
import { useAxios } from '@/lib/services/axios';
import { Link } from 'react-router';
import { FileSignature } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader } from '@/components/app/page';
import { useApiQuery } from '@/lib/services/api';
import type { Connection } from '../integrations/IntegrationsPage';


/**
 * Document templates live in the institution's e-signature provider (the Documenso connector, docs/plans/05): they
 * are edited there and referenced by workflow steps. Signed documents are attached to their cases.
 */
export default function DocumentsPage() {
  const { data: connections = [] } = useApiQuery<Connection[]>(['integrations', 'list'], '/integrations');
  const signing = connections.filter((c) => c.connectorId === 'documenso' && c.status === 'active');
  return (
    <PageContainer>
      <PageHeader title="Documents" description="Agreement templates come from your e-signature provider; signed documents are attached to their cases." />
      {signing.length === 0 ? (
        <EmptyState>
          No e-signature provider is connected. <Button variant="link" asChild className="px-1"><Link to="/app/integrations">Connect Documenso</Link></Button> to use its templates in workflows.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signing.map((c) => <TemplatesCard key={c.id} connection={c} />)}
        </div>
      )}
    </PageContainer>
  );
}

function TemplatesCard({ connection }: { connection: Connection }) {
  const { data, isLoading } = useTemplates(connection.id);
  return (
    <Card data-testid="signature-connection">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4" />{connection.displayName}</CardTitle>
        <CardDescription>Templates available to workflow signature steps</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <ul className="space-y-1 text-sm" data-testid="templates">
            {(data ?? []).map((t) => <li key={t.value}>{t.label} <span className="text-muted-foreground">#{t.value}</span></li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}


const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

function useTemplates(connectionId: string) {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['integrations', connectionId, 'templates'],
    enabled: ready,
    queryFn: async () => ((await axios.post(`${API_BASE_URL}/integrations/${connectionId}/options/templates`)).data.options ?? []) as Array<{ value: string; label: string }>,
  });
}
