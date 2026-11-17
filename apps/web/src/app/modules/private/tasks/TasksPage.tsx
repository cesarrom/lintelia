import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AlarmClock, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, PageContainer, PageHeader, StatusBadge, TableCard, formatDate, formatRelative, humanize } from '@/components/app/page';
import { Avatar } from '@/components/brand/Monogram';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import type { TaskSummary } from './types';

type View = 'mine' | 'queue' | 'all';

/** Due date with urgency: overdue in red, due within a day in amber. */
function Due({ at }: { at: string | null }) {
  if (!at) return <span className="text-muted-foreground/50">—</span>;
  const ms = new Date(at).getTime() - Date.now();
  const tone = ms < 0 ? 'text-destructive' : ms < 86_400_000 ? 'text-[hsl(30_85%_38%)] dark:text-warning' : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', tone)} title={formatDate(at)}>
      {ms < 86_400_000 && <AlarmClock className="h-3.5 w-3.5" />}
      {formatRelative(at)}
    </span>
  );
}

function Count({ value }: { value: number | undefined }) {
  if (!value) return null;
  return <span className="rounded-full bg-foreground/[0.07] px-1.5 text-[11px] font-semibold tabular text-foreground/70">{value}</span>;
}

/** Work inbox: tasks assigned to me, my roles' queues (claim to start) and — for team leads — every open task. */
export default function TasksPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [view, setView] = useState<View>('mine');
  const { data: tasks = [], isLoading } = useApiQuery<TaskSummary[]>(['tasks', view], `/tasks?view=${view}`, { refetchInterval: 5000 });
  const { data: mine } = useApiQuery<TaskSummary[]>(['tasks', 'mine'], '/tasks?view=mine', { refetchInterval: 5000 });
  const { data: queue } = useApiQuery<TaskSummary[]>(['tasks', 'queue'], '/tasks?view=queue', { refetchInterval: 5000 });
  const claim = useApiMutation<string>(({ axios, url }, taskId) => axios.post(url(`/tasks/${taskId}/claim`)), [['tasks']]);

  const onClaim = async (task: TaskSummary) => {
    try {
      await claim.mutateAsync(task.id);
      toast.success('Task claimed');
      navigate(`/app/tasks/${task.id}`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  return (
    <PageContainer>
      <PageHeader icon={ClipboardCheck} title="Tasks" description="Reviews and decisions routed to you and your team" />
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="mine">My tasks<Count value={mine?.length} /></TabsTrigger>
          <TabsTrigger value="queue">Team queue<Count value={queue?.length} /></TabsTrigger>
          {hasPermission('tasks:assign') && <TabsTrigger value="all">All open</TabsTrigger>}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <TableCard className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</TableCard>
      ) : tasks.length === 0 ? (
        <EmptyState art="tasks" title={view === 'mine' ? 'You are all caught up' : 'Queue clear'}>
          {view === 'mine' ? 'Nothing assigned to you. Pick up work from the team queue.' : 'The queue is empty.'}
        </EmptyState>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} data-testid="task-row" data-case-reference={task.case?.reference} data-task-id={task.id}>
                  <TableCell className="max-w-[380px]">
                    <button className="text-left font-medium text-foreground decoration-muted-foreground/40 underline-offset-4 hover:underline" onClick={() => navigate(`/app/tasks/${task.id}`)}>{task.title}</button>
                    {task.authority === 'high' && (
                      <span className="mt-1 flex">
                        <span className="inline-flex items-center gap-1 rounded-md bg-destructive/[0.08] px-1.5 py-0.5 text-[11px] font-medium text-destructive ring-1 ring-inset ring-destructive/20"><ShieldAlert className="h-3 w-3" />High authority</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{task.case?.reference}</TableCell>
                  <TableCell>
                    {task.case?.applicantName || task.case?.applicantEmail ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={task.case?.applicantName} email={task.case?.applicantEmail} size="xs" />
                        <span className="truncate">{task.case?.applicantName || task.case?.applicantEmail}</span>
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{task.status === 'pending_second_approval' ? 'Second approval' : humanize(task.queue?.role)}</TableCell>
                  <TableCell><StatusBadge status={task.status} /></TableCell>
                  <TableCell><Due at={task.dueAt} /></TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap text-right">
                    {view !== 'mine' && !task.assignee && (
                      <Button size="sm" onClick={() => onClaim(task)} disabled={claim.isPending}>Claim</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/tasks/${task.id}`)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </PageContainer>
  );
}
