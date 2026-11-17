import { ConnectorLogo } from '@/components/brand/ConnectorLogo';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Plug, Settings2, Trash2 } from 'lucide-react';
import { CONNECTOR_SCOPES } from '@repo/fintivio/schemas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

export interface CatalogConnector {
  id: string;
  name: string;
  description: string;
  version: string;
  publisher: { name: string; url?: string };
  categories: string[];
  scopes: string[];
  docsUrl: string | null;
  components: Array<{ key: string; title: string; description: string; kind: string }>;
}

export interface Connection {
  id: string;
  connectorId: string;
  connectorName: string;
  connectorVersion: string;
  displayName: string;
  status: 'pending' | 'active' | 'failing' | 'disabled';
  configSummary: Record<string, unknown>;
  lastError: string | null;
  scopes: string[];
  createdBy: string;
  createdAt: string;
  available: boolean;
}

interface HandOff { url: string; mode: 'redirect' | 'embedded'; installationId?: string }

/** Consent before connecting: what the connector will be able to do (its scopes) and what it adds to workflows. */
function ConnectDialog({ connector, onClose }: { connector: CatalogConnector | null; onClose: () => void }) {
  const install = useApiMutation<string, HandOff>(({ axios, url }, id) => axios.post(url(`/integrations/${id}/install`)), [['integrations']]);
  const connect = async () => {
    if (!connector) return;
    try {
      const handOff = await install.mutateAsync(connector.id);
      // The connector's own pages collect its settings and secrets; it sends the browser back here when done.
      window.location.assign(handOff.url);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  return (
    <Dialog open={!!connector} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {connector?.name}</DialogTitle>
          <DialogDescription>
            You will continue on the {connector?.name} connector's page (by {connector?.publisher.name}) to enter its settings.
            Secrets stay with the connector and are never shown to Fintivio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-1">It will be able to</p>
            <ul className="list-disc pl-5 space-y-1" data-testid="connector-scopes">
              {connector?.scopes.map((s) => <li key={s}>{CONNECTOR_SCOPES[s] ?? s}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">It adds to your workflows</p>
            <ul className="list-disc pl-5 space-y-1">
              {connector?.components.map((c) => <li key={c.key}>{c.title}<span className="text-muted-foreground"> · {c.description}</span></li>)}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={connect} disabled={install.isPending}>Continue to {connector?.name}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The connector's settings page, embedded (it tells us when it saved with a postMessage from its own origin). */
function SettingsDialog({ handOff, title, onClose }: { handOff: HandOff | null; title: string; onClose: (saved: boolean) => void }) {
  useEffect(() => {
    if (!handOff) return;
    const origin = new URL(handOff.url).origin;
    const listener = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.type !== 'fintivio:connector-saved') return;
      toast.success(event.data.message ?? 'Saved');
      onClose(true);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handOff, onClose]);
  return (
    <Dialog open={!!handOff} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>This page is served by the connector.</DialogDescription>
        </DialogHeader>
        {handOff && (
          <iframe title={`${title} (connector page)`} src={handOff.url} className="w-full h-[65vh] rounded-md border bg-white" sandbox="allow-forms allow-scripts allow-same-origin allow-top-navigation-by-user-activation" />
        )}
      </DialogContent>
    </Dialog>
  );
}

const summaryText = (summary: Record<string, unknown>) => Object.entries(summary ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(' · ');

/** The institution's connections to its own systems and vendors (docs/plans/03). */
export default function IntegrationsPage() {
  const { hasPermission } = useAuth();
  const manage = hasPermission('integrations:manage');
  const [params, setParams] = useSearchParams();
  const { data: catalog = [] } = useApiQuery<CatalogConnector[]>(['integrations', 'catalog'], '/integrations/catalog');
  const { data: connections = [], isLoading, refetch } = useApiQuery<Connection[]>(['integrations', 'list'], '/integrations', { refetchInterval: 10_000 });
  const [connecting, setConnecting] = useState<CatalogConnector | null>(null);
  const [settings, setSettings] = useState<{ handOff: HandOff; title: string } | null>(null);
  const [removing, setRemoving] = useState<Connection | null>(null);

  const openSettings = useApiMutation<string, HandOff>(({ axios, url }, id) => axios.post(url(`/integrations/${id}/setup-session`)));
  const remove = useApiMutation<string>(({ axios, url }, id) => axios.delete(url(`/integrations/${id}`)), [['integrations'], ['workflow-components']]);

  // Back from a connector's connect page.
  useEffect(() => {
    const installed = params.get('installed');
    if (!installed) return;
    void refetch().then(({ data }) => {
      const connection = data?.find((c) => c.id === installed);
      if (connection?.status === 'active') toast.success(`${connection.connectorName} connected`);
      else toast.message('The connection is not finished yet: open its settings to complete it.');
    });
    params.delete('installed');
    setParams(params, { replace: true });
  }, [params, setParams, refetch]);

  const settingsOf = async (connection: Connection) => {
    try {
      const handOff = await openSettings.mutateAsync(connection.id);
      if (handOff.mode === 'redirect') window.location.assign(handOff.url);
      else setSettings({ handOff, title: `${connection.connectorName} settings` });
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.id);
      toast.success(`${removing.displayName} removed`);
      setRemoving(null);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Integrations" description="Connect your own systems and vendors. Each connection adds steps to your workflows; its settings and secrets stay with the connector." />

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold tracking-tight">Your connections</h2>
        {!isLoading && connections.length === 0 ? <EmptyState art="connect" title="No connections yet">Connect a vendor below: its steps become available in the workflow editor.</EmptyState> : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader><TableRow><TableHead>Connection</TableHead><TableHead>Connector</TableHead><TableHead>Status</TableHead><TableHead>Settings</TableHead><TableHead>Added</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {connections.map((c) => (
                  <TableRow key={c.id} data-testid="connection-row" data-connector={c.connectorId} data-status={c.status}>
                    <TableCell className="font-medium"><span className="flex items-center gap-3"><ConnectorLogo id={c.connectorId} className="h-8 w-8 rounded-lg" />{c.displayName}</span></TableCell>
                    <TableCell className="text-sm">{c.connectorName}<span className="text-muted-foreground"> v{c.connectorVersion}</span></TableCell>
                    <TableCell>
                      <StatusBadge status={c.status === 'pending' ? 'draft' : c.status === 'failing' ? 'rejected' : c.status} label={{ pending: 'Not finished', active: 'Active', failing: 'Failing', disabled: 'Removed' }[c.status]} />
                      {c.lastError && <p className="text-xs text-red-700 mt-1">{c.lastError}</p>}
                      {!c.available && <p className="text-xs text-red-700 mt-1">Connector unavailable</p>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">{summaryText(c.configSummary)}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.createdAt)}<br /><span className="text-muted-foreground">{c.createdBy}</span></TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      {manage && c.available && <Button size="sm" variant="outline" onClick={() => settingsOf(c)}><Settings2 className="h-4 w-4" />{c.status === 'pending' ? 'Finish setup' : 'Settings'}</Button>}
                      {manage && <Button size="sm" variant="ghost" aria-label={`Remove ${c.displayName}`} onClick={() => setRemoving(c)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3 mt-8">
        <h2 className="text-[15px] font-semibold tracking-tight">Available connectors</h2>
        {catalog.length === 0 ? <EmptyState art="connect">No connectors are available yet.</EmptyState> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((connector) => (
              <Card key={connector.id} data-testid="connector-card" data-connector={connector.id} className="flex flex-col transition hover:border-primary/30 hover:shadow-raised">
                <CardHeader className="flex-row items-start gap-3.5 space-y-0">
                  <ConnectorLogo id={connector.id} className="h-11 w-11" />
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-[15px]">{connector.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">by {connector.publisher.name} · v{connector.version}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <CardDescription>{connector.description}</CardDescription>
                  <div className="flex flex-wrap gap-1.5">{connector.components.map((c) => <Badge key={c.key} variant="outline"><Plug className="h-3 w-3 text-muted-foreground" />{c.title}</Badge>)}</div>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 py-3">
                  {manage ? <Button size="sm" onClick={() => setConnecting(connector)}>Connect</Button> : <span className="text-xs text-muted-foreground">Ask an integration manager to connect it</span>}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConnectDialog connector={connecting} onClose={() => setConnecting(null)} />
      <SettingsDialog handOff={settings?.handOff ?? null} title={settings?.title ?? ''} onClose={(saved) => { setSettings(null); if (saved) void refetch(); }} />
      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.displayName}?</DialogTitle>
            <DialogDescription>Workflow steps using this connection will stop working. The connector deletes its settings and secrets.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={remove.isPending}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
