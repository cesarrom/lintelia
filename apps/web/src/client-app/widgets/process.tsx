import { ArrowRight, BellRing, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/components/app/page';
import { cn } from '@/lib/utils';
import { AppIcon } from '../icons';
import { useRuntime } from '../runtime';
import type { JourneyView, MyCaseView, MyRequestView, NotificationView } from '../types';
import { Empty, WidgetCard, useLink, type WidgetProps } from './shared';

export function QuickActionsWidget({ props, scope }: WidgetProps) {
  const link = useLink();
  const actions = (Array.isArray(props.actions) ? props.actions : []) as Array<{ label?: string; icon?: string; journey?: string; page?: string; input?: Record<string, unknown>; params?: Record<string, unknown> }>;
  const runtime = useRuntime();
  const known = Array.isArray(scope.journeys);
  const journeys = (scope.journeys ?? []) as JourneyView[];
  // A journey the client may not start (eligibility) is not offered; hidden journeys are never listed, so they stay.
  const shown = actions.filter((a) => !a.journey || !known || runtime.definition.journeys[a.journey]?.hidden || journeys.some((j) => j.key === a.journey));
  return (
    <WidgetCard title={props.title || undefined} bare testId="quick-actions">
      <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        {shown.map((action, i) => {
          const busy = !!action.journey && link.starting === action.journey;
          return (
            <button
              key={i} type="button" onClick={() => void link.go(action, null, scope)} disabled={!!link.starting} data-testid="quick-action"
              className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition-colors hover:bg-foreground/[0.03] sm:min-w-[104px] sm:flex-row sm:gap-2.5 sm:border sm:bg-card sm:px-4 sm:py-3 sm:text-left sm:shadow-card sm:hover:border-primary/30"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-9 sm:w-9 sm:rounded-xl">
                {busy ? <Loader2 className="h-5 w-5 animate-spin sm:h-4 sm:w-4" /> : <AppIcon name={action.icon} fallback="arrow-right" className="h-5 w-5 sm:h-4 sm:w-4" />}
              </span>
              <span className="text-[12.5px] font-medium leading-tight sm:text-sm">{action.label}</span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}

export function JourneysWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const journeys = ((scope.journeys ?? []) as JourneyView[]).filter((j) => !props.category || j.category === props.category);
  if (!journeys.length) return <WidgetCard title={props.title || undefined}><Empty>Nothing to start right now.</Empty></WidgetCard>;
  if (props.layout === 'list') {
    return (
      <WidgetCard title={props.title || undefined} testId="journeys">
        <ul className="divide-y">
          {journeys.map((j) => (
            <li key={j.key}>
              <button type="button" onClick={() => void runtime.startJourney(j.key)} disabled={!!runtime.starting} data-testid="journey" data-journey={j.key} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{runtime.starting === j.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <AppIcon name={j.icon} fallback="sparkles" className="h-[18px] w-[18px]" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{j.title}</span>
                  {j.description && <span className="block truncate text-xs text-muted-foreground">{j.description}</span>}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </button>
            </li>
          ))}
        </ul>
      </WidgetCard>
    );
  }
  return (
    <WidgetCard title={props.title || undefined} bare testId="journeys">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {journeys.map((j) => (
          <button
            key={j.key} type="button" onClick={() => void runtime.startJourney(j.key)} disabled={!!runtime.starting} data-testid="journey" data-journey={j.key}
            className="group flex flex-col rounded-2xl border bg-card p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raised"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">{runtime.starting === j.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppIcon name={j.icon} fallback="sparkles" className="h-5 w-5" />}</span>
              {j.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{j.category}</span>}
            </span>
            <span className="mt-4 block text-[15.5px] font-semibold tracking-tight">{j.title}</span>
            {j.description && <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{j.description}</span>}
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">Start<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
          </button>
        ))}
      </div>
    </WidgetCard>
  );
}

export function ApplicationsWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const cases = ((scope.cases ?? []) as MyCaseView[]).slice(0, Number(props.limit) > 0 ? Number(props.limit) : undefined);
  return (
    <WidgetCard title={props.title || undefined} testId="applications">
      {!cases.length ? <Empty>{props.empty || 'No applications yet.'}</Empty> : (
        <ul className="divide-y">
          {cases.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => runtime.openCase(c.id, c.journey)} className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-muted/40" data-testid="application" data-reference={c.reference}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><AppIcon name={c.icon} fallback="file-text" className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="block truncate text-xs text-muted-foreground"><span className="font-mono">{c.reference}</span>{c.stage && !c.final ? ` · ${c.stage}` : ''} · {formatRelative(c.updatedAt)}</span>
                  {!c.final && (
                    <span className="mt-2 block h-1.5 max-w-[220px] overflow-hidden rounded-full bg-muted">
                      <span className={cn('block h-full rounded-full', c.waitingForMe ? 'bg-warning' : 'bg-primary')} style={{ width: `${c.progress}%` }} />
                    </span>
                  )}
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', c.waitingForMe ? 'bg-warning-soft text-[hsl(30_85%_34%)]' : ['approved', 'completed'].includes(c.status) ? 'bg-success-soft text-success' : c.final ? 'bg-muted text-muted-foreground' : 'bg-primary-soft text-primary')} data-testid="application-status">
                  {c.waitingForMe ? 'Waiting for you' : c.statusLabel}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function RequestsWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const requests = ((scope.requests ?? []) as MyRequestView[]).filter((r) => r.status === 'open');
  return (
    <WidgetCard title={props.title || undefined} testId="requests" className={requests.length ? 'border-warning/40' : undefined}>
      {!requests.length ? <Empty>{props.empty || 'Nothing is waiting for you.'}</Empty> : (
        <ul className="divide-y">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5" data-testid="app-request">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-[hsl(30_85%_38%)]"><BellRing className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.kind === 'screen' && r.case ? `Continue: ${r.case.title}` : r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.kind === 'screen' ? r.title : r.case?.title ?? r.description ?? ''}{r.dueAt ? ` · by ${new Date(r.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
              </span>
              <Button size="sm" onClick={() => (r.case ? runtime.openCase(r.case.id, r.journey) : runtime.openPage('__requests'))}>{r.kind === 'screen' ? 'Continue' : 'Answer'}<ArrowRight className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

export function NotificationsWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const notifications = ((scope.notifications ?? []) as NotificationView[]).slice(0, Number(props.limit) > 0 ? Number(props.limit) : 10);
  return (
    <WidgetCard title={props.title || undefined} testId="notifications">
      {!notifications.length ? <Empty>No messages yet.</Empty> : (
        <ul className="divide-y">
          {notifications.map((n) => <NotificationRow key={n.id} notification={n} onOpen={() => openNotification(runtime, n)} />)}
        </ul>
      )}
    </WidgetCard>
  );
}

export function openNotification(runtime: ReturnType<typeof useRuntime>, n: NotificationView) {
  if (n.link?.page) runtime.openPage(n.link.page, n.link.params ?? {});
  else if (n.link?.caseId) runtime.openCase(n.link.caseId);
}

const TONE_DOT: Record<string, string> = { success: 'bg-success', warning: 'bg-warning', info: 'bg-info', brand: 'bg-primary' };

export function NotificationRow({ notification: n, onOpen, compact }: { notification: NotificationView; onOpen: () => void; compact?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn('flex w-full items-start gap-3 text-left transition-colors hover:bg-muted/40', compact ? 'px-4 py-3' : 'px-5 py-3.5')} data-testid="notification" data-read={n.read}>
        <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', n.read ? 'bg-muted text-muted-foreground' : 'bg-primary-soft text-primary')}><Inbox className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {!n.read && <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[n.tone] ?? 'bg-primary')} />}
            <span className={cn('truncate text-sm', n.read ? 'font-medium' : 'font-semibold')}>{n.title}</span>
          </span>
          {n.body && <span className={cn('mt-0.5 block text-[13px] text-muted-foreground', compact && 'line-clamp-2')}>{n.body}</span>}
          <span className="mt-1 block text-[11.5px] text-muted-foreground/80">{formatRelative(n.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}
