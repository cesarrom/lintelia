import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageContainer, PageHeader, StatusBadge, formatDate, humanize } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiMutation, useApiQuery } from '@/lib/services/api';
import type { TaskSummary } from './types';

type View = 'mine' | 'queue' | 'all';

/** Work inbox: tasks assigned to me, my roles' queues (claim to start) and — for team leads — every open task. */
export default function TasksPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [view, setView] = useState<View>('mine');
  const { data: tasks = [], isLoading } = useApiQuery<TaskSummary[]>(['tasks', view], `/tasks?view=${view}`, { refetchInterval: 5000 });
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
      <PageHeader title="Tasks" description="Reviews and decisions routed to you and your team" />
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <TabsList>
          <TabsTrigger value="mine">My tasks</TabsTrigger>
          <TabsTrigger value="queue">Team queue</TabsTrigger>
          {hasPermission('tasks:assign') && <TabsTrigger value="all">All open</TabsTrigger>}
        </TabsList>
      </Tabs>

      {!isLoading && tasks.length === 0 ? (
        <EmptyState>{view === 'mine' ? 'Nothing assigned to you. Pick up work from the team queue.' : 'The queue is empty.'}</EmptyState>
      ) : (
        <div className="rounded-md border">
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
                  <TableCell className="font-medium">
                    <button className="text-left hover:underline" onClick={() => navigate(`/app/tasks/${task.id}`)}>{task.title}</button>
                    {task.authority === 'high' && <Badge variant="outline" className="ml-2 border-red-300 text-red-700">High authority</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{task.case?.reference}</TableCell>
                  <TableCell>{task.case?.applicantName || task.case?.applicantEmail || '—'}</TableCell>
                  <TableCell>{task.status === 'pending_second_approval' ? 'Second approval' : humanize(task.queue?.role)}</TableCell>
                  <TableCell><StatusBadge status={task.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(task.dueAt)}</TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {view !== 'mine' && !task.assignee && (
                      <Button size="sm" onClick={() => onClaim(task)} disabled={claim.isPending}>Claim</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/tasks/${task.id}`)}>Open</Button>
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
