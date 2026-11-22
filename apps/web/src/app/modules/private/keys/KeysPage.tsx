import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Plus, RotateCw, Trash2 } from 'lucide-react';
import type { PermissionDefinition } from '@repo/lintelia/schemas';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { API_BASE_URL } from '@/lib/auth/session';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';

interface ApiClient {
  id: string;
  clientId: string;
  name: string;
  permissions: string[];
  status: 'active' | 'revoked';
  secrets: Array<{ id: string; prefix: string; createdAt: string; expiresAt: string | null }>;
  expiresAt: string | null;
  createdBy: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Shown once after creating a client or rotating its secret. */
function SecretDialog({ value, onClose }: { value: { clientId: string; clientSecret: string } | null; onClose: () => void }) {
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied'));
  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy the secret now</DialogTitle>
          <DialogDescription>It is shown only once. Store it in your system's secret manager.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div><Label>Client id</Label><div className="flex gap-2"><Input readOnly value={value?.clientId ?? ''} data-testid="client-id" /><Button size="icon" variant="outline" aria-label="Copy client id" onClick={() => copy(value!.clientId)}><Copy className="h-4 w-4" /></Button></div></div>
          <div><Label>Client secret</Label><div className="flex gap-2"><Input readOnly value={value?.clientSecret ?? ''} data-testid="client-secret" /><Button size="icon" variant="outline" aria-label="Copy client secret" onClick={() => copy(value!.clientSecret)}><Copy className="h-4 w-4" /></Button></div></div>
          <p className="text-muted-foreground">Get a token: <code className="text-xs">POST {API_BASE_URL}/oauth/token</code> with <code className="text-xs">grant_type=client_credentials</code> and these credentials (HTTP Basic or form fields). Tokens last 15 minutes.</p>
        </div>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ open, onOpenChange, catalog, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; catalog: PermissionDefinition[]; onCreated: (secret: { clientId: string; clientSecret: string }) => void }) {
  const { permissions: mine } = useAuth();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const create = useApiMutation<void, ApiClient & { clientSecret: string }>(({ axios, url }) => axios.post(url('/api-clients'), { name, permissions: selected }), [['api-clients']]);
  const submit = async () => {
    setError(null);
    try {
      const created = await create.mutateAsync();
      setName(''); setSelected([]);
      onOpenChange(false);
      onCreated({ clientId: created.clientId, clientSecret: created.clientSecret });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  const grantable = catalog.filter((p) => mine.includes(p.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New API client</DialogTitle>
          <DialogDescription>For one of your systems (core banking, CRM…). It can only do what you allow here, never more than you can.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="client-name">Name</Label><Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Core banking sync" /></div>
          <fieldset className="grid gap-2 md:grid-cols-2">
            <legend className="text-sm font-medium mb-2">Permissions</legend>
            {grantable.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm">
                <Checkbox aria-label={p.name} checked={selected.includes(p.id)} onCheckedChange={(v) => setSelected((s) => v === true ? [...s, p.id] : s.filter((x) => x !== p.id))} />
                <span>{p.name}<span className="block text-xs text-muted-foreground">{p.id}</span></span>
              </label>
            ))}
          </fieldset>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name || !selected.length || create.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** API clients: the institution's systems calling Lintelia with OAuth 2.0 client credentials (docs/plans/04). */
export default function KeysPage() {
  const { data: clients = [], isLoading } = useApiQuery<ApiClient[]>(['api-clients'], '/api-clients');
  const { data: catalog = [] } = useApiQuery<PermissionDefinition[]>(['permissions'], '/permissions');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const rotate = useApiMutation<string, ApiClient & { clientSecret: string }>(({ axios, url }, clientId) => axios.post(url(`/api-clients/${clientId}/rotate-secret`)), [['api-clients']]);
  const revoke = useApiMutation<string>(({ axios, url }, clientId) => axios.delete(url(`/api-clients/${clientId}`)), [['api-clients']]);

  const onRotate = async (client: ApiClient) => {
    try {
      const rotated = await rotate.mutateAsync(client.clientId);
      setSecret({ clientId: rotated.clientId, clientSecret: rotated.clientSecret });
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const onRevoke = async (client: ApiClient) => {
    if (!window.confirm(`Revoke ${client.name}? Its tokens stop working immediately.`)) return;
    try {
      await revoke.mutateAsync(client.clientId);
      toast.success(`${client.name} revoked`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="API clients"
        description="Credentials for your own systems to call Lintelia (OAuth 2.0 client credentials). Each client gets only the permissions you choose."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />New API client</Button>}
      />
      {!isLoading && clients.length === 0 ? <EmptyState art="connect" title="No API clients yet">Create credentials for a system that should start cases or read their status.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Client id</TableHead><TableHead>Permissions</TableHead><TableHead>Status</TableHead><TableHead>Last used</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} data-testid="api-client-row" data-status={c.status}>
                  <TableCell className="font-medium"><KeyRound className="inline h-4 w-4 mr-1" />{c.name}<span className="block text-xs text-muted-foreground">by {c.createdBy} · {formatDate(c.createdAt)}</span></TableCell>
                  <TableCell className="font-mono text-xs">{c.clientId}</TableCell>
                  <TableCell className="max-w-sm"><div className="flex flex-wrap gap-1">{c.permissions.map((p) => <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>)}</div></TableCell>
                  <TableCell><StatusBadge status={c.status === 'active' ? 'active' : 'closed'} label={c.status === 'active' ? 'Active' : 'Revoked'} />{c.secrets.some((s) => s.expiresAt) && <span className="block text-xs text-muted-foreground">rotating</span>}</TableCell>
                  <TableCell className="text-xs">{c.lastUsedAt ? formatDate(c.lastUsedAt) : 'never'}</TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {c.status === 'active' && <Button size="sm" variant="outline" onClick={() => onRotate(c)}><RotateCw className="h-4 w-4 mr-1" />Rotate secret</Button>}
                    {c.status === 'active' && <Button size="sm" variant="ghost" aria-label={`Revoke ${c.name}`} onClick={() => onRevoke(c)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CreateDialog open={creating} onOpenChange={setCreating} catalog={catalog} onCreated={setSecret} />
      <SecretDialog value={secret} onClose={() => setSecret(null)} />
    </PageContainer>
  );
}
