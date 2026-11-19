import { useState } from 'react';
import { usePollInterval } from '@/lib/live';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, Loader2, Radio, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge, formatDate, formatRelative, humanize } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAxios } from '@/lib/services/axios';
import { apiErrorMessage, useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import type { CaseSignal, Stage } from './types';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/**
 * Where the case is in the workflow's business stages (docs/plans/12): done, current, ahead. A stage outside the main
 * path (e.g. "declined") shows as the current one with everything before it done.
 */
export function StageBar({ stages, current, final }: { stages: Stage[]; current: string | null; final: boolean }) {
  // Exit stages (declined, withdrawn) only show when the case took that exit, after the main path.
  const exited = stages.find((s) => s.exit && s.key === current);
  stages = [...stages.filter((s) => !s.exit), ...(exited ? [exited] : [])];
  if (!stages.length) return null;
  const index = current && !exited ? stages.findIndex((s) => s.key === current) : -1;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 border-t px-6 py-3.5 text-[12.5px]" data-testid="case-stages" data-stage={current ?? ''}>
      {stages.map((stage, i) => {
        const state = stage === exited ? 'exit' : i < index || (final && i === index) ? 'done' : i === index ? 'current' : 'todo';
        return (
          <li key={stage.key} className="flex items-center gap-1" data-testid="case-stage" data-state={state} data-key={stage.key}>
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
              state === 'done' && 'text-success', state === 'current' && 'bg-primary text-primary-foreground shadow-sm', state === 'todo' && 'text-muted-foreground',
              state === 'exit' && 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/30',
            )}>
              {state === 'done' ? <Check className="h-3.5 w-3.5" /> : state === 'exit' ? <X className="h-3.5 w-3.5" /> : <span className={cn('h-1.5 w-1.5 rounded-full', state === 'current' ? 'bg-primary-foreground' : 'bg-muted-foreground/40')} />}
              {stage.label}
            </span>
            {i < stages.length - 1 && <span className="h-px w-4 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * What the case waits for from outside (`webhook.wait`) and what it received. Members with `cases:signal` can record
 * a signal themselves (e.g. the title arrived by mail instead of through the title service).
 */
export function SignalsCard({ caseId, active }: { caseId: string; active: boolean }) {
  const { hasPermission } = useAuth();
  const poll = usePollInterval(4000);
  const { data: signals = [] } = useApiQuery<CaseSignal[]>(['cases', 'signals', caseId], `/cases/${caseId}/signals`, { refetchInterval: active ? poll : undefined });
  const [deliver, setDeliver] = useState<string | null>(null);
  if (!signals.length) return null;
  return (
    <Card data-testid="case-signals">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" />Signals and events</CardTitle>
        <CardDescription>What this case waits for from other systems — call-backs by name, events about its business keys — and what arrived</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/60 text-sm">
          {signals.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" data-testid="case-signal" data-name={s.name} data-status={s.status}>
              <div className="min-w-0">
                <p className="font-mono text-[13px] font-medium">{s.name}{s.kind === 'event' && s.keys && Object.keys(s.keys).length > 0 && <span className="ml-2 font-sans text-xs font-normal text-muted-foreground" data-testid="event-keys">about {Object.entries(s.keys).map(([k, v]) => `${k} ${v}`).join(', ')}</span>}</p>
                <p className="text-xs text-muted-foreground" title={formatDate(s.deliveredAt ?? s.createdAt)}>
                  {s.status === 'waiting' ? `waiting since ${formatRelative(s.createdAt)}` : s.status === 'pending' ? `arrived ${formatRelative(s.createdAt)}, before the case asked for it` : s.status === 'delivered' ? `received ${formatRelative(s.deliveredAt ?? s.createdAt)}${s.source ? ` from ${humanize(s.source.split(':')[0])}` : ''}` : 'no longer expected'}
                  {s.fields.length > 0 && <> · {s.fields.join(', ')}</>}
                </p>
                {s.hookUrl && (
                  <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid="copy-hook"
                    onClick={() => void navigator.clipboard?.writeText(s.hookUrl!).then(() => toast.success('Address copied: give it to the system that will call back'))}>
                    <Copy className="h-3 w-3" />Copy the call-back address
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.status === 'delivered' ? 'approved' : s.status === 'cancelled' ? 'closed' : 'open'} label={humanize(s.status)} />
                {s.status === 'waiting' && s.kind !== 'event' && active && hasPermission('cases:signal') && (
                  <Button size="sm" variant="outline" onClick={() => setDeliver(s.name)} data-testid="record-signal"><Send className="h-3.5 w-3.5" />Record it</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <DeliverDialog caseId={caseId} name={deliver} onClose={() => setDeliver(null)} />
    </Card>
  );
}

function DeliverDialog({ caseId, name, onClose }: { caseId: string; name: string | null; onClose: () => void }) {
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('{\n  \n}');
  const [busy, setBusy] = useState(false);
  let parsed: unknown = null;
  let invalid = false;
  try {
    parsed = JSON.parse(body || '{}');
  } catch {
    invalid = true;
  }
  const submit = async () => {
    if (!name || invalid) return;
    setBusy(true);
    try {
      await axios.post(`${API_BASE_URL}/cases/${caseId}/signals/${name}`, parsed);
      toast.success(`Signal ${name} recorded`);
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record “{name}”</DialogTitle>
          <DialogDescription>What the other system would have sent, as JSON. The workflow continues with it; this is audited.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="signal-body">Data</Label>
          <Textarea id="signal-body" rows={7} className="font-mono text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} data-testid="signal-body" />
          {invalid && <p className="text-xs text-destructive">Not valid JSON yet.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || invalid} data-testid="signal-submit">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Record the signal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
