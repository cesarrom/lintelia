import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { ClientWidget } from '@repo/fintivio/schemas';
import { FullScreenLoader } from '@/components/app/loading';
import { cn } from '@/lib/utils';
import { AppShell } from './AppShell';
import { SourcesProvider, type SourcesHook } from './data-source';
import { BaseProvider } from './live';
import { RuntimeProvider, WidgetFrameProvider, type AppRuntime } from './runtime';
import { PageSkeleton } from './pages';
import type { AppData, AppDefinition, Institution } from './types';

/**
 * The studio's canvas (docs/plans/11 §9): the real app shell and widgets in a frame, fed by the studio through
 * postMessage (same origin only) — the draft definition, the data (sample client or a real client's data) and the
 * selected widget. Clicking a widget selects it in the studio; actions (journeys) are not run.
 */
export const PREVIEW_BASE = '/app/experience/preview';

export type StudioMessage =
  | { type: 'fintivio-studio:state'; definition: AppDefinition; institution: Institution; data: AppData; selected: string | null }
  | { type: 'fintivio-studio:navigate'; page: string; params?: Record<string, string> };

export type PreviewMessage =
  | { type: 'fintivio-preview:ready' }
  | { type: 'fintivio-preview:select'; widgetId: string }
  | { type: 'fintivio-preview:location'; page: string; params: Record<string, string> };

const post = (message: PreviewMessage) => window.parent?.postMessage(message, window.location.origin);

export default function PreviewFrame() {
  const [state, setState] = useState<Extract<StudioMessage, { type: 'fintivio-studio:state' }> | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Messages may arrive before React re-renders (e.g. the first state and a navigation together): read the latest.
  const home = useRef<string | null>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent<StudioMessage>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || !event.data?.type) return;
      if (event.data.type === 'fintivio-studio:state') {
        home.current = event.data.definition.home;
        setState(event.data);
      }
      if (event.data.type === 'fintivio-studio:navigate') {
        const { page, params = {} } = event.data;
        const query = new URLSearchParams(params).toString();
        navigate(page === home.current && !query ? PREVIEW_BASE : `${PREVIEW_BASE}/p/${page}${query ? `?${query}` : ''}`);
      }
    };
    window.addEventListener('message', onMessage);
    post({ type: 'fintivio-preview:ready' });
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  // Tell the studio which page is shown (the designer may follow links in the preview).
  useEffect(() => {
    if (!state) return;
    const match = location.pathname.match(/\/p\/([^/]+)/);
    post({ type: 'fintivio-preview:location', page: match?.[1] ?? state.definition.home, params: Object.fromEntries(new URLSearchParams(location.search)) });
  }, [location.pathname, location.search, state?.definition.home]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <FullScreenLoader label="Loading the preview…" />;
  return <PreviewApp definition={state.definition} institution={state.institution} data={state.data} selected={state.selected} />;
}

function PreviewApp({ definition, institution, data, selected }: { definition: AppDefinition; institution: Institution; data: AppData; selected: string | null }) {
  const navigate = useNavigate();
  const openPage = useCallback((page: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    navigate(page === definition.home && !query ? PREVIEW_BASE : `${PREVIEW_BASE}/p/${page}${query ? `?${query}` : ''}`);
  }, [navigate, definition.home]);

  const runtime = useMemo<AppRuntime>(() => ({
    definition, institution, mode: 'preview', starting: null, openPage,
    startJourney: async (journey) => { toast.info(`Starts the journey “${definition.journeys[journey]?.title ?? journey}”`, { description: 'Journeys run in the live app only.' }); },
    openCase: () => { toast.info('Opens the application in the live app'); },
  }), [definition, institution, openPage]);

  const hook = useMemo<SourcesHook>(() => () => ({ data, isLoading: false }), [data]);
  const frame = useCallback((widget: ClientWidget, _path: string, element: ReactNode) => <Selectable widget={widget} selected={selected === widget.id}>{element}</Selectable>, [selected]);

  return (
    <BaseProvider value={PREVIEW_BASE}>
      <RuntimeProvider runtime={runtime}>
        <SourcesProvider hook={hook}>
          <WidgetFrameProvider value={frame}>
            <AppShell>
              <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
            </AppShell>
          </WidgetFrameProvider>
        </SourcesProvider>
      </RuntimeProvider>
    </BaseProvider>
  );
}

function Selectable({ widget, selected, children }: { widget: ClientWidget; selected: boolean; children: ReactNode }) {
  useEffect(() => {
    if (selected) document.querySelector(`[data-select-id="${widget.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected, widget.id]);
  return (
    <div
      data-select-id={widget.id}
      onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); post({ type: 'fintivio-preview:select', widgetId: widget.id }); }}
      className={cn('group/select relative cursor-pointer rounded-2xl outline-offset-4 transition-[outline-color]', selected ? 'outline outline-2 outline-[#6d58f0]' : 'outline outline-2 outline-transparent hover:outline-[#6d58f0]/40')}
    >
      {children}
      <span className={cn('pointer-events-none absolute -top-3 left-3 z-10 rounded-md bg-[#6d58f0] px-1.5 py-0.5 text-[10.5px] font-medium text-white shadow', selected ? 'opacity-100' : 'opacity-0 group-hover/select:opacity-100')}>{widget.type}</span>
    </div>
  );
}
