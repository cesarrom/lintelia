import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Hourglass, Loader2, PlayCircle, XCircle } from 'lucide-react';
import { BUILTIN_PAGES, type BackOfficeDefinition, type BackOfficeWidget } from '@repo/fintivio/schemas';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { humanize } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiQuery } from '@/lib/services/api';
import { useLive, useLiveStatus } from '@/lib/live';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';
import { RuntimeProvider, WidgetList, pageScope, type AppRuntime } from '@/client-app/runtime';
import { ScreenForm, type FieldErrors } from '@/client-app/ScreenForm';
import type { AppData, AppDefinition, ScreenView } from '@/client-app/types';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/**
 * The institution's own back office in the web app (docs/plans/16): the published definition as the API pruned it for
 * this member, its pages and additions to built-in pages drawn by the client app's renderer (one renderer, the back
 * office's theme), and its actions — a workflow started with the page's client or case, whose staff screens open in a
 * dialog or a sheet.
 */
export interface BackOfficeApp { available: boolean; version?: number; definition?: BackOfficeDefinition }
export interface BackOfficeContextValue { client?: string; case?: string }

interface Progress {
  case: { id: string; reference: string; title: string; status: string; outcome: string | null; final: boolean };
  state: 'screen' | 'waiting' | 'working' | 'done';
  screen: ScreenView | null;
  waitingFor: Array<{ title: string; queue: string | null; status: string }>;
  /** Where to listen (docs/plans/17 §4.6): the case, and what its workflow publishes. */
  live?: { topics: string[] };
}

interface Running { action: string; label: string; mode: 'dialog' | 'sheet'; size?: 'sm' | 'md' | 'lg'; progress: Progress }

interface BackOfficeRuntimeValue {
  app: BackOfficeApp | undefined;
  definition: BackOfficeDefinition | null;
  run: (action: string, context?: BackOfficeContextValue, input?: Record<string, unknown>) => Promise<void>;
  /** Open the member's screen of a case again (a wizard left half-way). */
  resume: (caseId: string, label: string) => Promise<void>;
  starting: string | null;
}

export interface PendingScreen { taskId: string; title: string; createdAt: string; case: { id: string; reference: string; title: string } }

const Context = createContext<BackOfficeRuntimeValue>({ app: undefined, definition: null, run: async () => undefined, resume: async () => undefined, starting: null });
export const useBackOffice = () => useContext(Context);

/** The pages of the back office in the client renderer's terms: actions are its "journeys". */
export function asAppDefinition(definition: BackOfficeDefinition | null): AppDefinition {
  const journeys = Object.fromEntries(Object.entries(definition?.actions ?? {}).map(([key, action]) => [key, {
    workflowId: action.workflowId, title: action.label, description: action.description, icon: action.icon, inputs: action.inputs, stages: [], hidden: true,
  }]));
  return {
    schemaVersion: '1', name: definition?.name ?? 'Back office', home: 'home', navigation: [], pages: {}, journeys, collections: [],
    profile: { fields: [] }, registration: { enabled: false, methods: [], fields: [], consents: [] }, theme: { radius: 'default', header: 'light' }, embed: { allowedOrigins: [] },
  } as unknown as AppDefinition;
}

export function BackOfficeProvider({ children }: { children: ReactNode }) {
  const { kind, isAuthenticated } = useAuth();
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const { data: app } = useApiQuery<BackOfficeApp>(['backoffice', 'app'], isAuthenticated && kind === 'member' ? '/backoffice/app' : null);
  const [starting, setStarting] = useState<string | null>(null);
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState<string | null>(null);
  const definition = app?.available ? app.definition ?? null : null;

  const run = useCallback(async (key: string, context: BackOfficeContextValue = {}, input: Record<string, unknown> = {}) => {
    const action = definition?.actions[key];
    if (!action) return;
    setStarting(key);
    setError(null);
    try {
      const { data } = await axios.post<Progress>(`${API_BASE_URL}/backoffice/actions/${key}`, { context, input });
      setRunning({ action: key, label: action.label, mode: action.presentation?.mode ?? 'dialog', size: action.presentation?.size, progress: data });
    } catch (e) {
      setError(apiErrorMessage(e));
      setRunning({ action: key, label: action.label, mode: 'dialog', progress: null as unknown as Progress });
    } finally {
      setStarting(null);
    }
  }, [axios, definition]);

  const resume = useCallback(async (caseId: string, label: string) => {
    setStarting(caseId);
    setError(null);
    try {
      const { data } = await axios.get<Progress>(`${API_BASE_URL}/backoffice/cases/${caseId}/progress`);
      setRunning({ action: '', label, mode: 'dialog', progress: data });
    } catch (e) {
      setError(apiErrorMessage(e));
      setRunning({ action: '', label, mode: 'dialog', progress: null as unknown as Progress });
    } finally {
      setStarting(null);
    }
  }, [axios]);

  const value = useMemo(() => ({ app, definition, run, resume, starting }), [app, definition, run, resume, starting]);
  return (
    <Context.Provider value={value}>
      {children}
      {running && <ActionRunner running={running} error={error} onClose={() => { setRunning(null); setError(null); void queryClient.invalidateQueries({ queryKey: ['backoffice', 'screens'] }); }} />}
    </Context.Provider>
  );
}

/** The staff screens of a running action, then where it stands (done, waiting for someone, still working). */
function ActionRunner({ running, error: startError, onClose }: { running: Running; error: string | null; onClose: () => void }) {
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(startError);
  const caseId = running.progress?.case.id;
  const live = useLiveStatus() === 'connected';
  const { data: progress = running.progress, refetch } = useQuery<Progress>({
    queryKey: ['backoffice', 'progress', caseId],
    queryFn: async () => (await axios.get(`${API_BASE_URL}/backoffice/cases/${caseId}/progress`)).data,
    enabled: !!caseId,
    initialData: running.progress ?? undefined,
    refetchInterval: (query) => (['working', 'waiting'].includes(query.state.data?.state ?? '') ? (live ? 15_000 : query.state.data?.state === 'working' ? 700 : 4000) : false),
  });
  // The case moving wakes the dialog; what the workflow publishes on its "progress" channel shows as it comes.
  const [notes, setNotes] = useState<Array<{ seq: number; text: string }>>([]);
  useLive(progress?.live?.topics ?? [], (event) => {
    if (event.kind === 'change') void refetch();
    else if (event.topic.endsWith('/channel/progress')) {
      const text = String(event.payload.text ?? event.payload.title ?? '');
      if (text) setNotes((list) => (list.some((n) => n.seq === event.seq) ? list : [...list, { seq: event.seq, text }].sort((a, b) => a.seq - b.seq)));
    }
  }, { replay: true });

  const submit = async (event: string, values: Record<string, unknown>) => {
    if (!progress?.screen) return;
    setBusy(event);
    setErrors({});
    setError(null);
    try {
      const { data } = await axios.post<Progress>(`${API_BASE_URL}/backoffice/screens/${progress.screen.taskId}`, { event, values });
      queryClient.setQueryData(['backoffice', 'progress', caseId], data);
      if (data.state !== 'screen') {
        await Promise.all([queryClient.invalidateQueries({ queryKey: ['backoffice', 'data'] }), queryClient.invalidateQueries({ queryKey: ['backoffice', 'screens'] }), queryClient.invalidateQueries({ queryKey: ['cases'] }), queryClient.invalidateQueries({ queryKey: ['tasks'] })]);
      }
    } catch (e) {
      const details = (e as { response?: { data?: { errors?: Array<{ field: string; message: string }> } } })?.response?.data?.errors;
      if (Array.isArray(details)) setErrors(Object.fromEntries(details.map((d) => [d.field, d.message.replace(/^[^:]+:\s*/, '')])));
      setError(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const body = (
    <div className="space-y-4" data-testid="action-runner" data-state={progress?.state ?? 'error'}>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {progress?.state === 'screen' && progress.screen && (
        <ScreenForm screen={progress.screen} onSubmit={(event, values) => void submit(event, values)} busy={busy} errors={errors} error={null} />
      )}
      {progress?.state !== 'screen' && notes.length > 0 && <ProgressNotes notes={notes} />}
      {progress?.state === 'working' && !notes.length && <div className="space-y-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24 w-full" /></div>}
      {progress?.state === 'waiting' && (
        <Outcome icon={Hourglass} tone="info" title="Sent" text={`Waiting for: ${progress.waitingFor.map((w) => `${w.title}${w.queue ? ` (${humanize(w.queue)})` : ''}`).join('; ')}. You can follow it in Cases.`} reference={progress.case.reference} onClose={onClose} />
      )}
      {progress?.state === 'done' && (
        ['completed', 'approved'].includes(progress.case.status)
          ? <Outcome icon={CheckCircle2} tone="success" title="Done" text={humanize(progress.case.outcome ?? progress.case.status)} reference={progress.case.reference} onClose={onClose} />
          : <Outcome icon={XCircle} tone="neutral" title={humanize(progress.case.status)} text={humanize(progress.case.outcome ?? '')} reference={progress.case.reference} onClose={onClose} />
      )}
    </div>
  );

  const title = progress?.state === 'screen' ? progress.screen?.title ?? running.label : running.label;
  if (running.mode === 'sheet') {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{progress?.case.reference}</SheetDescription></SheetHeader>
          <div className="mt-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', running.size === 'lg' ? 'sm:max-w-3xl' : running.size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-xl')}>
        <DialogHeader><DialogTitle>{running.label}</DialogTitle><DialogDescription>{progress?.case.reference ?? ''}</DialogDescription></DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** Messages the workflow published while it works ("Checking the account…"), newest last. */
export function ProgressNotes({ notes }: { notes: Array<{ seq: number; text: string }> }) {
  return (
    <ol className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-sm" data-testid="live-progress" aria-live="polite">
      {notes.map((n, i) => (
        <li key={n.seq} className={cn('flex items-center gap-2', i < notes.length - 1 && 'text-muted-foreground')}>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', i === notes.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40')} />{n.text}
        </li>
      ))}
    </ol>
  );
}

function Outcome({ icon: Icon, tone, title, text, reference, onClose }: { icon: typeof CheckCircle2; tone: 'success' | 'info' | 'neutral'; title: string; text: string; reference: string; onClose: () => void }) {
  return (
    <div className="space-y-4 text-center" data-testid="action-outcome">
      <Icon className={cn('mx-auto h-10 w-10', tone === 'success' ? 'text-success' : tone === 'info' ? 'text-info' : 'text-muted-foreground')} />
      <div>
        <p className="text-lg font-semibold">{title}</p>
        {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
        <p className="mt-1 font-mono text-xs text-muted-foreground">{reference}</p>
      </div>
      <Button onClick={onClose}>Close</Button>
    </div>
  );
}

/** Where a page link goes: a built-in page (`builtin:case` with `{ id }`…) or one of the back office's pages. */
export function backOfficeHref(page: string, params: Record<string, string> = {}) {
  if (page.startsWith('builtin:')) {
    const key = page.slice('builtin:'.length);
    if (key === 'case' && params.id) return `/app/cases/${params.id}`;
    if (key === 'client' && params.id) return `/app/clients/${params.id}`;
    if (key === 'task' && params.id) return `/app/tasks/${params.id}`;
    return BUILTIN_PAGES[key as keyof typeof BUILTIN_PAGES]?.path ?? '/app/dashboard';
  }
  const query = new URLSearchParams(params).toString();
  return `/app/x/${page}${query ? `?${query}` : ''}`;
}

/**
 * Widgets of the back office with their data: a page of it (`page`, with the client or case it is about) or the
 * dashboard's additions (`slot`). The API resolves only what the page reads, under the member's rights.
 */
const NONE: Record<string, string> = {};
const NO_CONTEXT: BackOfficeContextValue = {};

export function BackOfficeWidgets({ widgets, page, slot, context = NO_CONTEXT, params = NONE }: {
  widgets: BackOfficeWidget[];
  page?: string;
  slot?: 'dashboard';
  context?: BackOfficeContextValue;
  params?: Record<string, string>;
}) {
  const navigate = useNavigate();
  const { axios, ready } = useAxios();
  const { definition, run, starting } = useBackOffice();
  const { tenant } = useAuth();
  const { data, error, isLoading } = useQuery<AppData>({
    queryKey: ['backoffice', 'data', page ?? slot, context.client ?? null, context.case ?? null],
    queryFn: async () => (await axios.post(`${API_BASE_URL}/backoffice/data`, { page, slot, context })).data,
    enabled: ready && !!definition,
    refetchInterval: 20_000,
  });
  const runtime = useMemo<AppRuntime>(() => ({
    definition: asAppDefinition(definition),
    institution: { name: tenant?.name ?? '', pallette: tenant?.pallette ?? null },
    mode: 'live',
    openPage: (target, targetParams) => navigate(backOfficeHref(target, targetParams)),
    startJourney: (action, input) => run(action, context, input),
    openCase: (caseId) => navigate(`/app/cases/${caseId}`),
    starting,
  }), [definition, tenant, navigate, run, context.client, context.case, starting]); // eslint-disable-line react-hooks/exhaustive-deps
  const scope = useMemo(() => pageScope(data, params), [data, params]);
  if (error) return <Alert variant="destructive"><AlertDescription>{apiErrorMessage(error)}</AlertDescription></Alert>;
  if (isLoading || !data) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>;
  return (
    <RuntimeProvider runtime={runtime}>
      <div data-testid="back-office-widgets" data-page={page ?? slot}>
        <WidgetList widgets={widgets} scope={scope} />
      </div>
    </RuntimeProvider>
  );
}


/** The staff screens waiting for this member (started and left half-way, or handed to them): one click to go on. */
export function PendingScreens({ caseId }: { caseId?: string }) {
  const { kind } = useAuth();
  const { resume, starting } = useBackOffice();
  const { data = [] } = useApiQuery<PendingScreen[]>(['backoffice', 'screens'], kind === 'member' ? '/backoffice/screens' : null);
  const items = caseId ? data.filter((s) => s.case.id === caseId) : data;
  if (!items.length) return null;
  if (caseId) {
    return (
      <Button onClick={() => void resume(caseId, items[0].title)} disabled={starting === caseId} data-testid="resume-screen">
        {starting === caseId ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}Continue: {items[0].title}
      </Button>
    );
  }
  return (
    <Alert data-testid="pending-screens">
      <PlayCircle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium text-foreground">Waiting for you</p>
        <ul className="mt-2 space-y-1">
          {items.slice(0, 5).map((s) => (
            <li key={s.taskId} className="flex flex-wrap items-center gap-2">
              <span>{s.title}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.case.reference}</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => void resume(s.case.id, s.title)} disabled={starting === s.case.id}>Continue</Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
