import { ConnectorLogo } from '@/components/brand/ConnectorLogo';
import { useState } from 'react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface RegisteredConnector {
  id: string;
  name: string;
  status: 'active' | 'revoked';
  manifest: { version: string; scopes: string[]; components: Array<{ key: string; title: string }>; baseUrl: string } | null;
  versions: Array<{ version: string; status: string; approvedBy: string | null; approvedAt: string | null; manifestUrl: string }>;
}

/** The connector registry (docs/plans/03): register versions from manifests, approve them, revoke a connector. */
export default function ConnectorsPage() {
  const { data: connectors = [], isLoading } = useApiQuery<RegisteredConnector[]>(['platform', 'connectors'], '/platform/connectors');
  const [manifestUrl, setManifestUrl] = useState('');
  const invalidate = [['platform', 'connectors']];
  const register = useApiMutation<void>(({ axios, url }) => axios.post(url('/platform/connectors'), { manifestUrl }), invalidate);
  const approve = useApiMutation<{ id: string; version: string }>(({ axios, url }, { id, version }) => axios.post(url(`/platform/connectors/${id}/versions/${version}/approve`)), invalidate);
  const revoke = useApiMutation<string>(({ axios, url }, id) => axios.post(url(`/platform/connectors/${id}/revoke`)), invalidate);

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast.success(message);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Connectors" description="Connector services institutions can install. New versions are drafts until approved; revoking stops every installation at once." />
      <form className="flex items-end gap-2 mb-6" onSubmit={(e) => { e.preventDefault(); void run(() => register.mutateAsync(), 'Version registered (draft)').then(() => setManifestUrl('')); }}>
        <div className="space-y-1 flex-1 max-w-xl">
          <Label htmlFor="manifest-url">Manifest URL</Label>
          <Input id="manifest-url" placeholder="https://connector.example/.well-known/fintivio-connector.json" value={manifestUrl} onChange={(e) => setManifestUrl(e.target.value)} />
        </div>
        <Button type="submit" disabled={!manifestUrl || register.isPending}>Register</Button>
      </form>
      {!isLoading && connectors.length === 0 ? <EmptyState art="connect">No connectors registered.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead>Connector</TableHead><TableHead>Status</TableHead><TableHead>Versions</TableHead><TableHead>Components</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {connectors.map((c) => (
                <TableRow key={c.id} data-testid="registry-row" data-connector={c.id}>
                  <TableCell><span className="flex items-center gap-3"><ConnectorLogo id={c.id} className="h-9 w-9 rounded-lg" /><span><span className="font-medium">{c.name}</span><br /><span className="text-xs text-muted-foreground">{c.id}</span></span></span></TableCell>
                  <TableCell><StatusBadge status={c.status === 'revoked' ? 'suspended' : 'active'} label={c.status === 'revoked' ? 'Revoked' : 'Active'} /></TableCell>
                  <TableCell className="text-sm space-y-1">
                    {c.versions.map((v) => (
                      <div key={v.version} className="flex items-center gap-2">
                        <span>v{v.version}</span>
                        <StatusBadge status={v.status === 'approved' ? 'approved' : 'draft'} label={v.status} />
                        {v.approvedAt && <span className="text-xs text-muted-foreground">by {v.approvedBy} {formatDate(v.approvedAt)}</span>}
                        {v.status !== 'approved' && <Button size="sm" variant="outline" onClick={() => run(() => approve.mutateAsync({ id: c.id, version: v.version }), `v${v.version} approved`)}>Approve</Button>}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-xs">{c.manifest?.components.map((x) => x.title).join(', ')}</TableCell>
                  <TableCell className="text-right">
                    {c.status === 'active'
                      ? <Button size="sm" variant="destructive" onClick={() => run(() => revoke.mutateAsync(c.id), `${c.name} revoked`)}>Revoke</Button>
                      : c.versions.some((v) => v.status === 'approved') && (
                        <Button size="sm" variant="outline" onClick={() => run(() => approve.mutateAsync({ id: c.id, version: c.versions.find((v) => v.status === 'approved')!.version }), `${c.name} reinstated`)}>Reinstate</Button>
                      )}
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
