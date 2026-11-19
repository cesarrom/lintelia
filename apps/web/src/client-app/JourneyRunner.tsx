import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiErrorMessage } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { useLive, useLiveStatus } from '@/lib/live';
import { followCase } from './live';
import { cn } from '@/lib/utils';
import { RequestCard, type ClientRequest } from '@/app/modules/portal/RequestCard';
import { AppIcon } from './icons';
import { useRuntime } from './runtime';
import { ScreenForm, type FieldErrors } from './ScreenForm';
import { RichText } from './widgets/shared';
import type { JourneyState } from './types';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;
export const journeyKey = (caseId: string) => ['client-app', 'journey', caseId];

/**
 * A journey in progress (docs/plans/11 §2.4): the screen the workflow shows now, a request of the team (documents,
 * identity check), "we are checking" while a person reviews, and the result. Polls while the workflow works.
 */
export function JourneyRunner({ caseId, onLeave, presentation = 'page', dismissible = true }: {
  caseId: string;
  onLeave: () => void;
  /** Where it shows (docs/plans/14): a page of the app, or over it (dialog, sheet, whole screen). */
  presentation?: 'page' | 'dialog' | 'sheet' | 'fullscreen';
  /** Over the page and not dismissible: no "Leave for now" (the journey's own buttons lead out). */
  dismissible?: boolean;
}) {
  const runtime = useRuntime();
  const root = useRef<HTMLDivElement>(null);
  const overlay = presentation !== 'page';
  const { axios, ready } = useAxios();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const live = useLiveStatus() === 'connected';
  const { data: state, error: loadError, isLoading } = useQuery<JourneyState>({
    queryKey: journeyKey(caseId),
    queryFn: async () => (await axios.get(`${API_BASE_URL}/me/app/cases/${caseId}/journey`)).data,
    enabled: ready,
    // With live updates the case tells us when it moves; polling is the safety net (docs/plans/17).
    refetchInterval: (query) => {
      const current = query.state.data?.state;
      if (live) return current === 'working' ? 5000 : current === 'waiting' || current === 'request' ? 30_000 : false;
      return current === 'working' ? 700 : current === 'waiting' || current === 'request' ? 4000 : false;
    },
  });
  // On screen: its notifications need not pop up too.
  useEffect(() => { followCase(caseId); }, [caseId, state?.state]);
  // What the workflow publishes on its "progress" channel ("Checking your ID…"), from the start.
  const [notes, setNotes] = useState<Array<{ seq: number; text: string }>>([]);
  useLive(state?.live?.topics ?? [], (event) => {
    if (event.kind === 'change') void queryClient.invalidateQueries({ queryKey: journeyKey(caseId) });
    else if (event.topic.endsWith('/channel/progress')) {
      const text = String(event.payload.text ?? event.payload.title ?? '');
      if (text) setNotes((list) => (list.some((n) => n.seq === event.seq) ? list : [...list, { seq: event.seq, text }].sort((a, b) => a.seq - b.seq)));
    }
  }, { replay: true });

  // Tell the host (embedded app) when the journey ends while the client looks at it.
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state) return;
    if (previous.current && previous.current !== 'done' && state.state === 'done') {
      runtime.emit?.('journey.completed', { journey: state.journey?.key ?? null, caseId, reference: state.case.reference, status: state.case.status, outcome: state.case.outcome });
    }
    previous.current = state.state;
  }, [state?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: string, values: Record<string, unknown>) => {
    if (!state?.screen) return;
    setBusy(event);
    setErrors({});
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/me/app/cases/${caseId}/screens/${state.screen.taskId}`, { event, values });
      queryClient.setQueryData(journeyKey(caseId), data);
      if (data.state === 'done') await queryClient.invalidateQueries({ queryKey: ['client-app', 'data'] });
      if (overlay) root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      const details = (e as { response?: { data?: { errors?: Array<{ field: string; message: string }> } } })?.response?.data?.errors;
      if (Array.isArray(details)) setErrors(Object.fromEntries(details.map((d) => [d.field, d.message.replace(/^[^:]+:\s*/, '')])));
      setError(apiErrorMessage(e));
      // The screen may have moved on (answered elsewhere): reload it.
      if ((e as { response?: { status?: number } })?.response?.status === 409) await queryClient.invalidateQueries({ queryKey: journeyKey(caseId) });
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !state) {
    if (loadError) return <Alert variant="destructive"><AlertDescription>{apiErrorMessage(loadError)}</AlertDescription></Alert>;
    return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-2 w-full" /><Skeleton className="h-80 w-full rounded-2xl" /></div>;
  }

  const done = state.state === 'done';
  const success = ['approved', 'completed'].includes(state.case.status);
  const finish = () => {
    void queryClient.invalidateQueries({ queryKey: ['client-app'] });
    if (state.journey?.donePage) runtime.openPage(state.journey.donePage);
    else onLeave();
  };

  return (
    <div ref={root} className={cn('mx-auto max-w-2xl', overlay ? 'space-y-5' : 'space-y-6')} data-testid="journey" data-state={state.state} data-case-reference={state.case.reference} data-presentation={presentation}>
      {overlay ? (
        <div className="pr-10"><span className="font-mono text-xs text-muted-foreground">{state.case.reference}</span></div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          {(dismissible || done) ? <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={onLeave}><ArrowLeft className="h-4 w-4" />{done ? 'Back' : 'Leave for now'}</Button> : <span />}
          <span className="font-mono text-xs text-muted-foreground">{state.case.reference}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-raised"><AppIcon name={state.journey?.icon} fallback="sparkles" className="h-5 w-5" /></span>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]" data-testid="journey-title">{state.journey?.title ?? state.case.title}</h1>
      </div>
      {state.stages.length > 1 && <Stages stages={state.stages} />}

      <div key={state.screen?.taskId ?? state.state} className={cn('animate-fade-up', presentation === 'page' || presentation === 'fullscreen' ? 'rounded-2xl border bg-card p-6 shadow-card sm:p-8' : 'border-t pt-6')}>
        {state.state === 'screen' && state.screen && (
          <ScreenForm screen={state.screen} onSubmit={submit} busy={busy} errors={errors} error={error} />
        )}
        {state.state === 'request' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">We need something from you to continue.</p>
            {state.requests.map((r) => (
              <RequestCard key={r.id} request={r as unknown as ClientRequest} caseId={caseId} respondPath={`/me/cases/${caseId}/requests/${r.id}/respond`} />
            ))}
          </div>
        )}
        {state.state === 'working' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center" data-testid="journey-working">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium" data-testid="journey-progress">{notes.at(-1)?.text ?? 'One moment…'}</p>
            {notes.length > 1 && (
              <ol className="space-y-1 text-sm text-muted-foreground" data-testid="journey-progress-history">
                {notes.slice(0, -1).map((n) => <li key={n.seq} className="flex items-center justify-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" />{n.text}</li>)}
              </ol>
            )}
          </div>
        )}
        {state.state === 'waiting' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="journey-waiting">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Clock3 className="h-7 w-7" /></span>
            <p className="text-lg font-semibold tracking-tight">Thanks — we are on it</p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Our team is checking your details, usually within one working day. We will let you know here and by e-mail. You can close the app in the meantime.</p>
            <Button variant="outline" className="mt-2" onClick={onLeave}>Back to home</Button>
          </div>
        )}
        {done && (
          <div className="flex flex-col items-center gap-3 py-8 text-center" data-testid="journey-done" data-status={state.case.status} data-outcome={state.case.outcome ?? ''}>
            <span className={cn('flex h-16 w-16 items-center justify-center rounded-full', success ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground')}>
              {success ? <CheckCircle2 className="h-9 w-9" /> : <XCircle className="h-9 w-9" />}
            </span>
            <p className="text-xl font-semibold tracking-tight" data-testid="journey-done-title">{state.message?.title ?? (success ? 'All done' : state.case.statusLabel)}</p>
            {state.message?.body ? <RichText text={state.message.body} className="max-w-md text-muted-foreground" /> : !success && <p className="max-w-md text-sm text-muted-foreground">If you have questions, message us from the Help page.</p>}
            <Button className="mt-3 min-w-[160px]" size="lg" onClick={finish} data-testid="journey-finish">Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stages({ stages }: { stages: JourneyState['stages'] }) {
  const current = Math.max(0, stages.findIndex((s) => s.status === 'current'));
  const allDone = stages.every((s) => s.status === 'done');
  return (
    <div data-testid="journey-stages">
      <p className="mb-2 text-xs font-medium text-muted-foreground sm:hidden">Step {allDone ? stages.length : current + 1} of {stages.length} · {stages[allDone ? stages.length - 1 : current]?.label}</p>
      <ol className="flex items-center gap-2">
        {stages.map((stage, i) => (
          <li key={stage.key} className="flex min-w-0 flex-1 items-center gap-2" data-status={stage.status}>
            <span className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
              stage.status === 'done' ? 'bg-primary text-primary-foreground' : stage.status === 'current' ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'bg-muted text-muted-foreground',
            )}>
              {stage.status === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden truncate text-[13px] sm:block', stage.status === 'current' ? 'font-semibold' : 'text-muted-foreground')}>{stage.label}</span>
            {i < stages.length - 1 && <span className={cn('h-px min-w-3 flex-1', stage.status === 'done' ? 'bg-primary' : 'bg-border')} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
