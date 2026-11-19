import { useState } from 'react';
import { useLiveInvalidate, usePollInterval } from '@/lib/live';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenForm, type FieldErrors } from '@/client-app/ScreenForm';
import type { ScreenView } from '@/client-app/types';
import { useAxios } from '@/lib/services/axios';
import { DetailLoader } from '@/components/app/loading';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Calculator, CalendarClock, CheckCircle2, CircleDot, CircleSlash, FileWarning, FolderOpen, Gavel, Hand, Hourglass, Inbox, Info, MessageSquareMore, ShieldAlert, UsersRound, XCircle, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/brand/Monogram';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyValues, PageContainer, StatusBadge, formatDate, humanize } from '@/components/app/page';
import { AnswerValue, FileList } from '@/components/app/files';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import type { TaskDetail } from './types';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

const ACTIONABLE = ['open', 'claimed', 'escalated', 'pending_second_approval'];

/** One task: the case it belongs to, what was decided so far, and the decision controls. */
export default function TaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { data: task, error, isLoading } = useApiQuery<TaskDetail>(['tasks', 'detail', taskId], `/tasks/${taskId}`, { refetchInterval: usePollInterval(4000) });
  // The task's case moving (a decision elsewhere, the client answering): fetched again at once.
  useLiveInvalidate([task?.caseId && `case/${task.caseId}`], [['tasks', 'detail', taskId]]);
  const { data: members = [] } = useApiQuery<Array<{ id: string; email: string; name: string; roles: string[]; status: string }>>(
    ['users'], '/users', { enabled: hasPermission('tasks:assign') && hasPermission('members:read') },
  );

  const [outcome, setOutcome] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  // "Ask the client": a written answer, or a document to upload (stipulations).
  const [askFile, setAskFile] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('');

  const claim = useApiMutation<void>(({ axios, url }) => axios.post(url(`/tasks/${taskId}/claim`)), [['tasks']]);
  const decide = useApiMutation<{ outcome: string; reason?: string; items?: Array<{ key: string; label: string; type: 'file' | 'text' }> }>(({ axios, url }, body) => axios.post(url(`/tasks/${taskId}/decision`), body), [['tasks'], ['cases']]);
  const assign = useApiMutation<string>(({ axios, url }, assigneeId) => axios.post(url(`/tasks/${taskId}/assign`), { assigneeId }), [['tasks']]);

  if (isLoading) return <DetailLoader />;
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
      const asksFile = selected.key === 'request_info' && askFile;
      const result = await decide.mutateAsync({ outcome: selected.key, reason: reason.trim() || undefined, ...(asksFile ? { items: [{ key: 'document', label: 'Document', type: 'file' as const }] } : {}) });
      toast.success(result?.status === 'pending_second_approval' ? 'First approval recorded — a second approver is needed' : 'Decision recorded');
      setOutcome(null);
      setReason('');
      setAskFile(false);
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
  const overdue = task.dueAt && new Date(task.dueAt).getTime() < Date.now();

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/app/tasks')}><ArrowLeft className="h-4 w-4" />Back to tasks</Button>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              {task.authority === 'high' && <Badge variant="destructive" className="ring-1 ring-inset ring-destructive/20"><ShieldAlert className="h-3 w-3" />High authority</Badge>}
              {task.authority === 'high' && task.outcomes.some((o) => o.needsSecondApproval) && <Badge className="ring-1 ring-inset ring-primary/20"><UsersRound className="h-3 w-3" />Four-eyes</Badge>}
            </div>
            <h1 className="mt-2.5 text-[24px] font-semibold leading-tight tracking-[-0.02em]" data-testid="task-title">{task.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" />Queue: {humanize(task.queue?.role)}</span>
              <span className={cn('inline-flex items-center gap-1.5', overdue && 'text-destructive')}><CalendarClock className="h-3.5 w-3.5" />Due {formatDate(task.dueAt)}</span>
              {task.assignee && <span className="inline-flex items-center gap-1.5"><Avatar email={task.assignee.email} size="xs" />Assigned to <span data-testid="task-assignee" className="font-medium text-foreground">{task.assignee.email}</span></span>}
            </div>
          </div>
          {task.case && (
            <Button variant="outline" onClick={() => navigate(`/app/cases/${task.case!.id}`)}><FolderOpen className="h-4 w-4" />Open case {task.case.reference}</Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {task.description && (
            <div className="flex gap-3 rounded-xl border border-info/20 bg-info-soft/60 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="task-description">{task.description}</p>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar name={task.case?.applicantName} email={task.case?.applicantEmail ?? task.case?.title} size="md" />
                <div className="min-w-0">
                  <CardTitle>{task.case?.title}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs">{task.case?.reference}</span> · {task.case?.applicantName || task.case?.applicantEmail || 'No applicant'}
                    {task.case?.riskLevel && <> · risk <StatusBadge status={task.case.riskLevel} /></>}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <KeyValues data={task.caseData} />
              {task.calculations.map((calc) => (
                <div key={calc.step} data-testid="calculation" className="rounded-xl border border-primary/15 bg-primary-soft/50 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><Calculator className="h-3.5 w-3.5 text-primary" />{calc.name}</h3>
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
                  <div key={i} className="rounded-lg border bg-muted/30 p-3">{Object.entries(answer as Record<string, unknown>).map(([k, v]) => <p key={k}><AnswerValue value={v} /></p>)}</div>
                ))}
              </CardContent>
            </Card>
          )}
          {(task.files?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle>Documents</CardTitle><CardDescription>Everything on the case, checked for malware and sanitised</CardDescription></CardHeader>
              <CardContent><FileList files={task.files!} /></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-4">
          {task.kind === 'screen' && task.screen && ['open', 'claimed', 'escalated'].includes(task.status) && (mine || !task.assignee) ? (
            <ScreenTaskCard taskId={task.id} screen={{ ...task.screen, taskId: task.id }} />
          ) : (
          <Card className={cn(canDecide && 'border-primary/30 shadow-raised')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" />Decision</CardTitle>
              {secondApproval && task.firstDecision && (
                <CardDescription data-testid="first-approval">
                  First approval by {task.firstDecision.byEmail} ({humanize(task.firstDecision.outcome)}){task.firstDecision.reason ? `: ${task.firstDecision.reason}` : ''}. A second person with high-risk authority must confirm.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {task.status === 'completed' && (
                <div className="flex gap-3 rounded-lg border border-success/20 bg-success-soft/70 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-sm" data-testid="task-decision">
                    <strong>{humanize(task.decision)}</strong> by {task.decidedBy} on {formatDate(task.decidedAt)}{task.decisionReason ? ` — ${task.decisionReason}` : ''}
                  </p>
                </div>
              )}
              {gaveFirstApproval && <p className="rounded-lg bg-muted/50 p-3 text-sm" data-testid="awaiting-second-approval">You gave the first approval. Waiting for a second approver.</p>}
              {task.status === 'pending_client' && <p className="flex gap-2 rounded-lg bg-warning-soft/70 p-3 text-sm"><Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-warning" />Waiting for the client to answer your request. The task comes back here when they do.</p>}
              {actionable && !task.assignee && !secondApproval && (
                <Button className="w-full" onClick={onClaim} disabled={claim.isPending}><Hand className="h-4 w-4" />Claim this task</Button>
              )}
              {canDecide && (
                <>
                  <div className="grid gap-2" role="group" aria-label="Outcome">
                    {outcomes.map((o) => {
                      const { icon: Icon, tone } = outcomeStyle(o.key, o.label);
                      const active = outcome === o.key;
                      return (
                        <button
                          key={o.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setOutcome(o.key)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm font-medium shadow-xs transition-colors hover:border-foreground/20 hover:bg-accent/50',
                            active && 'border-primary bg-primary-soft ring-4 ring-primary/10 hover:border-primary hover:bg-primary-soft',
                          )}
                        >
                          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', tone)}><Icon className="h-4 w-4" /></span>
                          <span className="flex-1">{secondApproval && o.key === 'approve' ? 'Confirm approval (second approver)' : o.label}</span>
                          <span aria-hidden="true" className={cn('h-4 w-4 rounded-full border-2', active ? 'border-primary bg-primary shadow-[inset_0_0_0_2px_hsl(var(--background))]' : 'border-input')} />
                        </button>
                      );
                    })}
                  </div>
                  {selected && (
                    <div className="space-y-2">
                      <Label htmlFor="decision-reason">{selected.key === 'request_info' ? 'What do you need from the client?' : 'Reason'}{reasonRequired ? ' (required)' : ' (optional)'}</Label>
                      <Textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
                      {selected.key === 'request_info' && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={askFile} onChange={(e) => setAskFile(e.target.checked)} data-testid="ask-for-document" />
                          They answer with a document (an upload)
                        </label>
                      )}
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
          )}

          {hasPermission('tasks:assign') && actionable && (
            <Card>
              <CardHeader><CardTitle>Reassign</CardTitle><CardDescription>Hand this task to a colleague</CardDescription></CardHeader>
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

/** A staff screen (`team.screen`) to fill: the workflow continues with the button pressed (docs/plans/16 §5.6). */
function ScreenTaskCard({ taskId, screen }: { taskId: string; screen: ScreenView }) {
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: string, values: Record<string, unknown>) => {
    setBusy(event);
    setErrors({});
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/backoffice/screens/${taskId}`, { event, values });
      toast.success('Sent');
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['tasks'] }), queryClient.invalidateQueries({ queryKey: ['cases'] })]);
    } catch (e) {
      const details = (e as { response?: { data?: { errors?: Array<{ field: string; message: string }> } } })?.response?.data?.errors;
      if (Array.isArray(details)) setErrors(Object.fromEntries(details.map((d) => [d.field, d.message.replace(/^[^:]+:\s*/, '')])));
      setError(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="border-primary/30 shadow-raised" data-testid="screen-task">
      <CardContent className="pt-6"><ScreenForm screen={screen} onSubmit={(event, values) => void submit(event, values)} busy={busy} errors={errors} error={error} /></CardContent>
    </Card>
  );
}

/** Icon and colour of an outcome, from its key or label (workflows name their own outcomes). */
function outcomeStyle(key: string, label: string): { icon: LucideIcon; tone: string } {
  const text = `${key} ${label}`.toLowerCase();
  if (/approv|confirm|accept/.test(text)) return { icon: CheckCircle2, tone: 'bg-success/10 text-success' };
  if (/reject|declin|exit|refus/.test(text)) return { icon: XCircle, tone: 'bg-destructive/10 text-destructive' };
  if (/request|ask|info|document/.test(text)) return { icon: MessageSquareMore, tone: 'bg-info/10 text-info' };
  if (/escalat|refer|mlro/.test(text)) return { icon: ArrowUpRight, tone: 'bg-warning/15 text-[hsl(30_85%_38%)] dark:text-warning' };
  if (/sar|report|file/.test(text)) return { icon: FileWarning, tone: 'bg-orange-500/10 text-orange-600' };
  if (/false|no_action|no further|close|dismiss/.test(text)) return { icon: CircleSlash, tone: 'bg-muted text-muted-foreground' };
  return { icon: CircleDot, tone: 'bg-primary/10 text-primary' };
}
