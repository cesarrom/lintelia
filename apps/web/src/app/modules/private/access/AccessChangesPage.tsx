import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Check, History, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate, formatRelative } from '@/components/app/page';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { CHANGE_STATUS_LABEL, type AccessChange } from '@/lib/access';

const KIND_LABEL: Record<string, string> = {
  'role.create': 'New role', 'role.update': 'Role change', 'role.delete': 'Role deleted', 'member.roles': 'Member roles', 'member.invite': 'Invitation',
  'sso.role_mappings': 'Identity provider groups', 'workflow.publish': 'Who may use a workflow',
  'security.access_policy': 'Approval policy',
};

const STATUS_TONE: Record<AccessChange['status'], string> = {
  pending_approval: 'pending', scheduled: 'open', applied: 'completed', rejected: 'rejected', cancelled: 'cancelled', expired: 'expired', failed: 'failed',
};

type Decision = { change: AccessChange; action: 'approve' | 'reject' } | null;

/** What changed: added and removed items, before/after (as the API describes them). */
function Diff({ diff }: { diff: Record<string, unknown> }) {
  const added = Array.isArray(diff.added) ? diff.added : [];
  const removed = Array.isArray(diff.removed) ? diff.removed : [];
  const line = (item: unknown) => (typeof item === 'string' ? item : item && typeof item === 'object' && 'group' in item ? `${(item as unknown as { group: string }).group} → ${(item as unknown as { role: string }).role}` : JSON.stringify(item));
  if (!added.length && !removed.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
      {added.map((a, i) => <span key={`a${i}`} className="rounded bg-success-soft px-1.5 py-0.5 text-success">+ {line(a)}</span>)}
      {removed.map((r, i) => <span key={`r${i}`} className="rounded bg-destructive/[0.08] px-1.5 py-0.5 text-destructive">− {line(r)}</span>)}
    </div>
  );
}

function ChangeCard({ change, onDecide, onCancel }: { change: AccessChange; onDecide: (d: Decision) => void; onCancel: (c: AccessChange) => void }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-card" data-testid="access-change" data-status={change.status} data-kind={change.kind}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABEL[change.kind] ?? change.kind}{change.grants && ' · grants access'}</p>
          <p className="mt-0.5 font-medium" data-testid="access-change-summary">{change.summary}</p>
          <Diff diff={change.diff} />
          <p className="mt-2 text-xs text-muted-foreground">
            Requested by {change.requestedBy.email ?? 'someone'} {formatRelative(change.createdAt)}
            {change.approvedBy && ` · ${change.status === 'rejected' ? 'rejected' : 'approved'} by ${change.approvedBy}`}
            {change.effectiveAt && ` · effective ${formatDate(change.effectiveAt)}`}
            {change.status === 'pending_approval' && change.expiresAt && ` · expires ${formatRelative(change.expiresAt)}`}
          </p>
          {change.decisionReason && <p className="mt-1 text-sm">“{change.decisionReason}”</p>}
          {change.error && <p className="mt-1 text-sm text-destructive">{change.error}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={STATUS_TONE[change.status]} label={CHANGE_STATUS_LABEL[change.status]} />
          <div className="flex gap-1.5">
            {change.canApprove && <Button size="sm" onClick={() => onDecide({ change, action: 'approve' })}><Check className="mr-1 h-4 w-4" />Approve</Button>}
            {change.canApprove && <Button size="sm" variant="outline" onClick={() => onDecide({ change, action: 'reject' })}><X className="mr-1 h-4 w-4" />Reject</Button>}
            {change.canCancel && <Button size="sm" variant="ghost" onClick={() => onCancel(change)}>Cancel</Button>}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Access changes (docs/plans/15 §14): privileged changes to roles, assignments, identity provider mappings and who may
 * use workflows — what waits for a second administrator, what is scheduled, and what happened.
 */
export default function AccessChangesPage() {
  const { data: changes = [] } = useApiQuery<AccessChange[]>(['access-changes', 'all'], '/access-changes', { refetchInterval: 10_000 });
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState('');
  const decide = useApiMutation<{ id: string; action: string; reason?: string }>(({ axios, url }, { id, action, reason: why }) => axios.post(url(`/access-changes/${id}/${action}`), { reason: why }),
    [['access-changes'], ['roles'], ['users'], ['sso'], ['security'], ['auth', 'me']]);

  const waiting = changes.filter((c) => c.status === 'pending_approval');
  const scheduled = changes.filter((c) => c.status === 'scheduled');
  const history = changes.filter((c) => !['pending_approval', 'scheduled'].includes(c.status));

  const run = async (id: string, action: 'approve' | 'reject' | 'cancel', why?: string) => {
    try {
      await decide.mutateAsync({ id, action, reason: why });
      toast.success(action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Cancelled');
      setDecision(null);
      setReason('');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const list = (items: AccessChange[], empty: string) => items.length === 0
    ? <EmptyState>{empty}</EmptyState>
    : <div className="space-y-3">{items.map((c) => <ChangeCard key={c.id} change={c} onDecide={setDecision} onCancel={(x) => run(x.id, 'cancel')} />)}</div>;

  return (
    <PageContainer>
      <PageHeader title="Access changes" description="Changes to roles, their members, your identity provider's groups and who may use workflows. Grants can wait for a second administrator; any change can wait for a date." />
      <Tabs defaultValue={waiting.length ? 'waiting' : 'history'} key={waiting.length ? 'w' : 'h'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="waiting"><ShieldCheck className="mr-1.5 h-4 w-4" />Waiting for approval ({waiting.length})</TabsTrigger>
          <TabsTrigger value="scheduled"><CalendarClock className="mr-1.5 h-4 w-4" />Scheduled ({scheduled.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" />History</TabsTrigger>
        </TabsList>
        <TabsContent value="waiting">{list(waiting, 'Nothing waits for an approval.')}</TabsContent>
        <TabsContent value="scheduled">{list(scheduled, 'No change is scheduled.')}</TabsContent>
        <TabsContent value="history">{list(history, 'No access change yet.')}</TabsContent>
      </Tabs>

      <Dialog open={!!decision} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{decision?.action === 'approve' ? 'Approve the change' : 'Reject the change'}</DialogTitle>
            <DialogDescription>{decision?.change.summary}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decision-reason">{decision?.action === 'approve' ? 'Note (optional)' : 'Why (required)'}</Label>
            <Textarea id="decision-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Back</Button>
            <Button onClick={() => decision && run(decision.change.id, decision.action, reason)} disabled={decide.isPending || (decision?.action === 'reject' && !reason.trim())}
              variant={decision?.action === 'reject' ? 'destructive' : 'default'}>
              {decision?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
