import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyValues, PageContainer, StatusBadge, formatDate, humanize } from '@/components/app/page';
import { AnswerValue } from '@/components/app/files';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import type { TaskDetail } from './types';

const ACTIONABLE = ['open', 'claimed', 'escalated', 'pending_second_approval'];

/** One task: the case it belongs to, what was decided so far, and the decision controls. */
export default function TaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { data: task, error, isLoading } = useApiQuery<TaskDetail>(['tasks', 'detail', taskId], `/tasks/${taskId}`, { refetchInterval: 4000 });
  const { data: members = [] } = useApiQuery<Array<{ id: string; email: string; name: string; roles: string[]; status: string }>>(
    ['users'], '/users', { enabled: hasPermission('tasks:assign') && hasPermission('members:read') },
  );

  const [outcome, setOutcome] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('');

  const claim = useApiMutation<void>(({ axios, url }) => axios.post(url(`/tasks/${taskId}/claim`)), [['tasks']]);
  const decide = useApiMutation<{ outcome: string; reason?: string }>(({ axios, url }, body) => axios.post(url(`/tasks/${taskId}/decision`), body), [['tasks'], ['cases']]);
  const assign = useApiMutation<string>(({ axios, url }, assigneeId) => axios.post(url(`/tasks/${taskId}/assign`), { assigneeId }), [['tasks']]);

  if (isLoading) return <PageContainer>Loading…</PageContainer>;
  if (error || !task) return <PageContainer><Alert variant="destructive"><AlertDescription>{apiErrorMessage(error) || 'Task not found'}</AlertDescription></Alert></PageContainer>;

  const mine = task.assignee?.id === user?.userId;
  const actionable = ACTIONABLE.includes(task.status);
  const secondApproval = task.status === 'pending_second_approval';
  const gaveFirstApproval = secondApproval && task.firstDecision?.by === user?.userId;
  const canDecide = actionable && hasPermission('tasks:work') && (mine || !task.assignee) && !gaveFirstApproval;
  const selected = task.outcomes.find((o) => o.key === outcome);
  const reasonRequired = !!selected?.requiresReason;

  const onClaim = async () => {
    try {
      await claim.mutateAsync();
      toast.success('Task claimed');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onDecide = async () => {
    if (!selected) return;
    setDecisionError(null);
    try {
      const result = await decide.mutateAsync({ outcome: selected.key, reason: reason.trim() || undefined });
      toast.success(result?.status === 'pending_second_approval' ? 'First approval recorded — a second approver is needed' : 'Decision recorded');
      setOutcome(null);
      setReason('');
    } catch (e) {
      setDecisionError(apiErrorMessage(e));
    }
  };

  const onAssign = async () => {
    try {
      await assign.mutateAsync(assignee);
      toast.success('Task reassigned');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const outcomes = secondApproval ? task.outcomes.filter((o) => o.key !== 'request_info') : task.outcomes;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate('/app/tasks')}><ArrowLeft className="h-4 w-4 mr-2" />Back to tasks</Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="task-title">{task.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={task.status} />
            {task.authority === 'high' && <Badge variant="outline" className="border-red-300 text-red-700">High authority</Badge>}
            {task.authority === 'high' && task.outcomes.some((o) => o.needsSecondApproval) && <Badge variant="outline" className="border-purple-300 text-purple-700">Four-eyes</Badge>}
            <span>Queue: {humanize(task.queue?.role)}</span>
            <span>· Due {formatDate(task.dueAt)}</span>
            {task.assignee && <span>· Assigned to <span data-testid="task-assignee">{task.assignee.email}</span></span>}
          </div>
        </div>
        {task.case && (
          <Button variant="outline" onClick={() => navigate(`/app/cases/${task.case!.id}`)}>Open case {task.case.reference}</Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {task.description && (
            <Card><CardContent className="pt-6 text-sm whitespace-pre-wrap" data-testid="task-description">{task.description}</CardContent></Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{task.case?.title}</CardTitle>
              <CardDescription>
                {task.case?.reference} · {task.case?.applicantName || task.case?.applicantEmail || 'No applicant'}
                {task.case?.riskLevel && <> · risk <StatusBadge status={task.case.riskLevel} /></>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <KeyValues data={task.caseData} />
              {task.calculations.map((calc) => (
                <div key={calc.step} data-testid="calculation">
                  <h3 className="mb-2 text-sm font-semibold">{calc.name}</h3>
                  <KeyValues data={calc.values} />
                </div>
              ))}
            </CardContent>
          </Card>
          {task.response && Object.keys(task.response).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Client's answers</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm" data-testid="client-answers">
                {Object.values(task.response).map((answer, i) => (
                  <div key={i}>{Object.entries(answer as Record<string, unknown>).map(([k, v]) => <p key={k}><AnswerValue value={v} /></p>)}</div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
              {secondApproval && task.firstDecision && (
                <CardDescription data-testid="first-approval">
                  First approval by {task.firstDecision.byEmail} ({humanize(task.firstDecision.outcome)}){task.firstDecision.reason ? `: ${task.firstDecision.reason}` : ''}. A second person with high-risk authority must confirm.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {task.status === 'completed' && (
                <p className="text-sm" data-testid="task-decision">
                  <strong>{humanize(task.decision)}</strong> by {task.decidedBy} on {formatDate(task.decidedAt)}{task.decisionReason ? ` — ${task.decisionReason}` : ''}
                </p>
              )}
              {gaveFirstApproval && <p className="text-sm" data-testid="awaiting-second-approval">You gave the first approval. Waiting for a second approver.</p>}
              {task.status === 'pending_client' && <p className="text-sm">Waiting for the client to answer your request. The task comes back here when they do.</p>}
              {actionable && !task.assignee && !secondApproval && (
                <Button className="w-full" onClick={onClaim} disabled={claim.isPending}>Claim this task</Button>
              )}
              {canDecide && (
                <>
                  <div className="grid gap-2" role="group" aria-label="Outcome">
                    {outcomes.map((o) => (
                      <Button
                        key={o.key}
                        type="button"
                        variant={outcome === o.key ? 'default' : 'outline'}
                        className={cn('justify-start', outcome === o.key && 'ring-2 ring-offset-1')}
                        aria-pressed={outcome === o.key}
                        onClick={() => setOutcome(o.key)}
                      >
                        {secondApproval && o.key === 'approve' ? 'Confirm approval (second approver)' : o.label}
                      </Button>
                    ))}
                  </div>
                  {selected && (
                    <div className="space-y-2">
                      <Label htmlFor="decision-reason">{selected.key === 'request_info' ? 'What do you need from the client?' : 'Reason'}{reasonRequired ? ' (required)' : ' (optional)'}</Label>
                      <Textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
                    </div>
                  )}
                  {decisionError && <Alert variant="destructive"><AlertDescription data-testid="decision-error">{decisionError}</AlertDescription></Alert>}
                  <Button className="w-full" onClick={onDecide} disabled={!selected || (reasonRequired && !reason.trim()) || decide.isPending}>
                    Confirm decision
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {hasPermission('tasks:assign') && actionable && (
            <Card>
              <CardHeader><CardTitle>Reassign</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger aria-label="Assignee"><SelectValue placeholder="Choose a member" /></SelectTrigger>
                  <SelectContent>
                    {members.filter((m) => m.status === 'active' && m.roles.length > 0).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name || m.email} ({m.roles.join(', ')})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full" onClick={onAssign} disabled={!assignee || assign.isPending}>Assign</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
