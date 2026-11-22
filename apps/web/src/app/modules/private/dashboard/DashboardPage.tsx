import { Link, useNavigate } from 'react-router';
import { usePollInterval } from '@/lib/live';
import { DashboardSlot, useHomeRedirect } from '@/back-office/pages';
import { PendingScreens } from '@/back-office/runtime';
import { ArrowRight, ArrowUpRight, Clock3, FolderKanban, Hourglass, Inbox, ListChecks, Sparkles, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer, StatCard, StatusBadge, formatDate, formatRelative, humanize } from '@/components/app/page';
import { TasksArt } from '@/components/brand/illustrations';
import { Avatar } from '@/components/brand/Monogram';
import { useAuth } from '@/lib/auth/AuthContext';
import { useApiQuery } from '@/lib/services/api';
import { memberRoutes } from '@/lib/routes/routes';
import { cn } from '@/lib/utils';
import type { CaseSummary } from '../cases/types';
import type { TaskSummary } from '../tasks/types';

const PIPELINE: Array<{ status: string; label: string; color: string }> = [
  { status: 'submitted', label: 'Received', color: 'bg-info/70' },
  { status: 'in_progress', label: 'In progress', color: 'bg-info' },
  { status: 'pending_client', label: 'Waiting for client', color: 'bg-warning/70' },
  { status: 'in_review', label: 'In review', color: 'bg-warning' },
  { status: 'approved', label: 'Approved', color: 'bg-success' },
  { status: 'rejected', label: 'Rejected', color: 'bg-destructive' },
  { status: 'closed', label: 'Closed', color: 'bg-muted-foreground/40' },
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** Where cases stand: one stacked bar and a legend with counts. */
function Pipeline({ cases }: { cases: CaseSummary[] }) {
  const counts = PIPELINE.map((p) => ({ ...p, count: cases.filter((c) => c.status === p.status).length })).filter((p) => p.count > 0);
  const total = cases.length || 1;
  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {counts.map((p) => <span key={p.status} className={cn('h-full first:rounded-l-full last:rounded-r-full', p.color)} style={{ width: `${(p.count / total) * 100}%` }} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {counts.map((p) => (
          <li key={p.status} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-2 text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', p.color)} />{p.label}</span>
            <span className="font-semibold tabular">{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskItem({ task, onOpen }: { task: TaskSummary; onOpen: () => void }) {
  const overdue = task.dueAt && new Date(task.dueAt).getTime() < Date.now();
  return (
    <li>
      <button onClick={onOpen} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60">
        <Avatar name={task.case?.applicantName} email={task.case?.applicantEmail ?? task.title} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{task.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{task.case?.reference}</span> · {humanize(task.queue?.role) || 'Task'}
            {task.authority === 'high' && <span className="text-destructive"> · high authority</span>}
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <StatusBadge status={task.status} />
          {task.dueAt && <span className={cn('text-[11px]', overdue ? 'text-destructive' : 'text-muted-foreground')}>due {formatRelative(task.dueAt)}</span>}
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>
    </li>
  );
}

/** Home of the back office: what needs attention, for the member's roles. */
export default function DashboardPage() {
  useHomeRedirect();
  const navigate = useNavigate();
  const { user, tenant, hasPermission } = useAuth();
  const canWork = hasPermission(['tasks:work', 'tasks:assign']);
  const canCases = hasPermission('cases:read');
  const poll = usePollInterval(10_000);
  const { data: mine = [], isLoading: loadingMine } = useApiQuery<TaskSummary[]>(['tasks', 'mine'], '/tasks?view=mine', { refetchInterval: poll, enabled: canWork });
  const { data: queue = [] } = useApiQuery<TaskSummary[]>(['tasks', 'queue'], '/tasks?view=queue', { refetchInterval: poll, enabled: canWork });
  const { data: cases = [], isLoading: loadingCases } = useApiQuery<CaseSummary[]>(['cases', 'list', '', 'all'], '/cases?', { refetchInterval: poll, enabled: canCases });

  const name = (user as { name?: string } | null)?.name?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const weekAgo = Date.now() - 7 * 86_400_000;
  const decided = cases.filter((c) => ['approved', 'rejected'].includes(c.status) && new Date(c.updatedAt).getTime() > weekAgo);
  const approved = decided.filter((c) => c.status === 'approved').length;
  const overdue = mine.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now()).length;
  const work = mine.length ? mine : queue;
  const shortcuts = memberRoutes.filter((r) => r.section !== 'Work' && (!r.permissions || hasPermission(r.permissions))).slice(0, 6);

  return (
    <PageContainer className="space-y-7">
      {/* greeting */}
      <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-6 shadow-card sm:px-8">
        <div className="bg-aurora pointer-events-none absolute inset-0 opacity-80" />
        <div className="bg-dots pointer-events-none absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · {tenant?.name}</p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{greeting()}{name && `, ${name}`}</h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {canWork
                ? mine.length
                  ? `${mine.length} ${mine.length === 1 ? 'task is' : 'tasks are'} assigned to you${overdue ? `, ${overdue} past due` : ''}. ${queue.length ? `${queue.length} more waiting in your team's queue.` : ''}`
                  : queue.length ? `Nothing assigned to you right now — ${queue.length} waiting in your team's queue.` : 'Nothing waits for you right now.'
                : 'Here is how your institution’s work is going.'}
            </p>
          </div>
          <TasksArt className="hidden w-44 md:block" />
        </div>
      </div>

      {/* numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canWork && <StatCard label="Assigned to me" value={mine.length} icon={ListChecks} tone="brand" hint={overdue ? `${overdue} past due` : 'On track'} onClick={() => navigate('/app/tasks')} />}
        {canWork && <StatCard label="Team queue" value={queue.length} icon={Inbox} tone="info" hint="Ready to be claimed" onClick={() => navigate('/app/tasks')} />}
        {canCases && <StatCard label="Cases in review" value={cases.filter((c) => c.status === 'in_review').length} icon={FolderKanban} tone="warning" hint={`${cases.length} cases in total`} onClick={() => navigate('/app/cases')} />}
        {canCases && <StatCard label="Waiting on clients" value={cases.filter((c) => c.status === 'pending_client').length} icon={Hourglass} tone="info" hint="Requests sent to applicants" />}
        {canCases && !canWork && <StatCard label="Decided this week" value={decided.length} icon={Sparkles} tone="success" hint={decided.length ? `${Math.round((approved / decided.length) * 100)}% approved` : 'No decisions yet'} />}
        {!canCases && !canWork && <StatCard label="Your role" value={humanize(user?.userTenants?.[0]?.roleNames?.[0] ?? 'member')} icon={UsersRound} tone="brand" />}
      </div>

      {/* Screens waiting for this member, and what the institution added to the dashboard (its back office, docs/plans/16). */}
      <PendingScreens />
      <DashboardSlot />

      <div className="grid items-start gap-6 lg:grid-cols-5">
        {canWork && (
          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle>{mine.length ? 'Your work' : 'Up next from the queue'}</CardTitle>
                <CardDescription>{mine.length ? 'Tasks you claimed, oldest first' : 'Claim one to start'}</CardDescription>
              </div>
              <Link to="/app/tasks" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">All tasks<ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              {loadingMine ? (
                <div className="space-y-2 px-3 pb-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : work.length === 0 ? (
                <div className="px-3 pb-6 pt-2 text-center text-sm text-muted-foreground">
                  <TasksArt className="mx-auto w-36" />
                  All clear — new tasks appear here as cases need a decision.
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">{work.slice(0, 5).map((t) => <TaskItem key={t.id} task={t} onOpen={() => navigate(`/app/tasks/${t.id}`)} />)}</ul>
                  {mine.length > 0 && queue.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Up next from the queue</p>
                      <ul className="divide-y divide-border/60">{queue.slice(0, 4).map((t) => <TaskItem key={t.id} task={t} onOpen={() => navigate(`/app/tasks/${t.id}`)} />)}</ul>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {canCases && (
          <div className={cn('space-y-6', canWork ? 'lg:col-span-2' : 'lg:col-span-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0')}>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Case pipeline</CardTitle>
                <CardDescription>{cases.length} cases · {decided.length} decided in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>{loadingCases ? <Skeleton className="h-24 w-full" /> : cases.length ? <Pipeline cases={cases} /> : <p className="text-sm text-muted-foreground">No cases yet.</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Recent cases</CardTitle>
                <Link to="/app/cases" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">All cases<ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <ul className="divide-y divide-border/60">
                  {cases.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <button onClick={() => navigate(`/app/cases/${c.id}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{c.title}</p>
                          <p className="flex items-center gap-1 text-[11.5px] text-muted-foreground"><Clock3 className="h-3 w-3" /><span title={formatDate(c.createdAt)}>{formatRelative(c.createdAt)}</span></p>
                        </div>
                        <StatusBadge status={c.status} />
                      </button>
                    </li>
                  ))}
                  {!cases.length && !loadingCases && <li className="px-3 py-4 text-sm text-muted-foreground">Cases appear here as applications arrive.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {shortcuts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Shortcuts</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {shortcuts.map((r) => (
              <Link key={r.href} to={r.href} className="group flex items-center gap-3 rounded-xl border bg-card p-3 shadow-card transition hover:border-primary/30 hover:shadow-raised">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><r.icon className="h-4 w-4" /></span>
                <span className="text-[13px] font-medium">{r.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
