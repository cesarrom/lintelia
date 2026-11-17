import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Copy, Plus, RotateCw, Send, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import type { WebhookDelivery, WebhookEventType, WebhookSubscription } from './types';

function SubscriptionDialog({ open, onOpenChange, events, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; events: WebhookEventType[]; onCreated: (secret: string) => void }) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const create = useApiMutation<void, WebhookSubscription & { secret: string }>(({ axios, url: to }) => axios.post(to('/webhooks'), { url, description, eventTypes: selected }), [['webhooks']]);
  const submit = async () => {
    setError(null);
    try {
      const created = await create.mutateAsync();
      setUrl(''); setDescription(''); setSelected([]);
      onOpenChange(false);
      onCreated(created.secret);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New webhook</DialogTitle>
          <DialogDescription>Fintivio will POST signed events (Standard Webhooks) to this URL and retry for up to a day if it fails.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="webhook-url">Endpoint URL</Label><Input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://bank.example/fintivio/webhooks" /></div>
          <div className="space-y-2"><Label htmlFor="webhook-description">Description</Label><Input id="webhook-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">Events</legend>
            {events.map((e) => (
              <label key={e.type} className="flex items-start gap-2 text-sm">
                <Checkbox aria-label={e.type} checked={selected.includes(e.type)} onCheckedChange={(v) => setSelected((s) => v === true ? [...s, e.type] : s.filter((x) => x !== e.type))} />
                <span><code>{e.type}</code><span className="block text-xs text-muted-foreground">{e.description}</span></span>
              </label>
            ))}
          </fieldset>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!url || !selected.length || create.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Deliveries({ subscription }: { subscription: WebhookSubscription }) {
  const { data: deliveries = [] } = useApiQuery<WebhookDelivery[]>(['webhooks', subscription.id, 'deliveries'], `/webhooks/${subscription.id}/deliveries`, { refetchInterval: 5000 });
  const resend = useApiMutation<string>(({ axios, url }, id) => axios.post(url(`/webhooks/deliveries/${id}/resend`)), [['webhooks', subscription.id, 'deliveries']]);
  if (!deliveries.length) return <p className="text-sm text-muted-foreground p-3">No deliveries yet.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Last answer</TableHead><TableHead>Created</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>
        {deliveries.map((d) => (
          <TableRow key={d.id} data-testid="delivery-row" data-status={d.status}>
            <TableCell className="text-xs"><code>{d.eventType}</code><span className="block text-muted-foreground">{d.eventId}</span></TableCell>
            <TableCell><StatusBadge status={d.status === 'delivered' ? 'approved' : d.status === 'failed' ? 'rejected' : 'open'} label={d.status} />{d.nextAttemptAt && <span className="block text-xs text-muted-foreground">next {formatDate(d.nextAttemptAt)}</span>}</TableCell>
            <TableCell className="text-xs">{d.attempts.map((a, i) => <span key={i} className="mr-1">{a.statusCode ?? 'error'}</span>)}</TableCell>
            <TableCell className="text-xs max-w-xs truncate" title={d.responseExcerpt ?? ''}>{d.lastStatusCode ?? '—'} {d.responseExcerpt?.slice(0, 60)}</TableCell>
            <TableCell className="text-xs">{formatDate(d.createdAt)}</TableCell>
            <TableCell><Button size="sm" variant="outline" onClick={() => resend.mutateAsync(d.id).then(() => toast.success('Resending'), (e) => toast.error(apiErrorMessage(e)))}>Resend</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Outbound webhooks: subscriptions, signing secrets and the delivery log (docs/plans/04). */
export default function WebhooksPage() {
  const { data: subscriptions = [], isLoading } = useApiQuery<WebhookSubscription[]>(['webhooks'], '/webhooks', { refetchInterval: 10_000 });
  const { data: events = [] } = useApiQuery<WebhookEventType[]>(['webhook-events'], '/webhook-events');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const update = useApiMutation<{ id: string; enabled: boolean }>(({ axios, url }, { id, enabled }) => axios.put(url(`/webhooks/${id}`), { enabled }), [['webhooks']]);
  const remove = useApiMutation<string>(({ axios, url }, id) => axios.delete(url(`/webhooks/${id}`)), [['webhooks']]);
  const rotate = useApiMutation<string, { secret: string }>(({ axios, url }, id) => axios.post(url(`/webhooks/${id}/rotate-secret`)), [['webhooks']]);
  const test = useApiMutation<string>(({ axios, url }, id) => axios.post(url(`/webhooks/${id}/test`)));

  const run = async (action: () => Promise<unknown>, message?: string) => {
    try {
      await action();
      if (message) toast.success(message);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Webhooks"
        description="Tell your systems when things happen: signed HTTP calls (Standard Webhooks), retried until they succeed, with a delivery log."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />New webhook</Button>}
      />
      {!isLoading && subscriptions.length === 0 ? <EmptyState art="connect" title="No webhooks yet">Add an endpoint to receive signed events when cases and tasks change.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader><TableRow><TableHead /><TableHead>Endpoint</TableHead><TableHead>Events</TableHead><TableHead>Status</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {subscriptions.map((s) => (
                <Fragment key={s.id}>
                  <TableRow data-testid="webhook-row" data-enabled={s.enabled}>
                    <TableCell className="w-8"><Button size="icon" variant="ghost" aria-label="Show deliveries" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>{expanded === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></TableCell>
                    <TableCell className="text-sm"><span className="font-mono text-xs break-all">{s.url}</span>{s.description && <span className="block text-xs text-muted-foreground">{s.description}</span>}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{s.eventTypes.map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}</div></TableCell>
                    <TableCell className="text-xs">
                      {!s.enabled ? <span className="text-red-700">Disabled{s.disabledReason ? `: ${s.disabledReason}` : ''}</span> : s.failingSince ? <span className="text-amber-700">Failing since {formatDate(s.failingSince)}</span> : 'Healthy'}
                      {s.rotatingUntil && <span className="block text-muted-foreground">previous secret valid until {formatDate(s.rotatingUntil)}</span>}
                    </TableCell>
                    <TableCell><Switch aria-label="Enabled" checked={s.enabled} onCheckedChange={(enabled) => run(() => update.mutateAsync({ id: s.id, enabled }))} /></TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => run(() => test.mutateAsync(s.id), 'Test event sent')}><Send className="h-4 w-4 mr-1" />Test</Button>
                      <Button size="sm" variant="outline" onClick={() => run(async () => setSecret((await rotate.mutateAsync(s.id)).secret))}><RotateCw className="h-4 w-4 mr-1" />Rotate secret</Button>
                      <Button size="sm" variant="ghost" aria-label="Delete webhook" onClick={() => window.confirm('Delete this webhook?') && run(() => remove.mutateAsync(s.id), 'Webhook deleted')}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                  {expanded === s.id && <TableRow><TableCell colSpan={6} className="bg-muted/30"><Deliveries subscription={s} /></TableCell></TableRow>}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <SubscriptionDialog open={creating} onOpenChange={setCreating} events={events} onCreated={setSecret} />
      <Dialog open={!!secret} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signing secret</DialogTitle>
            <DialogDescription>Shown only once. Verify the <code>webhook-signature</code> header with it (any Standard Webhooks library).</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2"><Input readOnly value={secret ?? ''} data-testid="webhook-secret" /><Button size="icon" variant="outline" aria-label="Copy secret" onClick={() => navigator.clipboard?.writeText(secret ?? '')}><Copy className="h-4 w-4" /></Button></div>
          <DialogFooter><Button onClick={() => setSecret(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
