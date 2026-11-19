import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { JourneyPresentation } from '@repo/fintivio/schemas';
import { useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { useLive, useLiveInvalidate, usePollInterval } from '@/lib/live';
import { RuntimeProvider, sourcesOf, type AppRuntime, type StartOptions } from './runtime';
import { JourneyOverlay, type JourneyOverlayState } from './JourneyOverlay';
import { journeyKey } from './JourneyRunner';
import type { AppData, AppView, JourneyState } from './types';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** Data of a set of sources, resolved by the API for the signed-in client. */
export function useAppData(sources: string[], key: string, options: { refetchInterval?: number } = {}) {
  const { axios, ready } = useAxios();
  const sorted = [...new Set(sources)].sort();
  // Live updates refresh the data as it changes (docs/plans/17); polling is the fallback while they are down.
  const refetchInterval = usePollInterval(options.refetchInterval ?? 15_000, 120_000);
  return useQuery<AppData>({
    queryKey: ['client-app', 'data', key, sorted],
    queryFn: async () => (await axios.post(`${API_BASE_URL}/me/app/data`, { sources: sorted })).data,
    enabled: ready && sorted.length > 0,
    refetchInterval,
  });
}

/** Cases whose result the client is already looking at (a journey on screen, a one-tap result toasted): their notifications do not pop up again. */
const followed = new Map<string, number>();
export const followCase = (caseId: string) => followed.set(caseId, Date.now());
const isFollowed = (caseId: string | undefined) => !!caseId && (followed.get(caseId) ?? 0) > Date.now() - 60_000;

/**
 * The client's app listens for what concerns them (docs/plans/17 §4.7): their records (a balance the core banking system
 * changes), notifications (shown as they arrive), applications and profile — the screen fetches its data again at
 * once — and the messages workflows send them.
 */
function LiveClientApp() {
  const { user } = useAuth();
  const { axios } = useAxios();
  const me = user?.kind === 'client' ? user.userId : null;
  useLiveInvalidate(me ? [`client/${me}/records/*`, `client/${me}/cases`, `client/${me}/profile`, `client/${me}/notifications`] : [], [['client-app', 'data']]);
  const shown = useRef<Set<string> | null>(null);
  const since = useRef(Date.now());
  useLive(me ? [`client/${me}/notifications`] : [], (event) => {
    if (event.kind !== 'change') return;
    void axios.post<AppData>(`${API_BASE_URL}/me/app/data`, { sources: ['notifications'] }).then(async ({ data }) => {
      shown.current ??= new Set();
      // A journey the client just ran answers with its result a moment later: give it that moment.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      for (const n of (data.notifications ?? []).slice().reverse()) {
        if (n.read || shown.current.has(n.id) || new Date(n.createdAt).getTime() < since.current - 5_000) continue;
        shown.current.add(n.id);
        if (isFollowed(n.link?.caseId)) continue;
        const show = n.tone === 'success' ? toast.success : n.tone === 'warning' ? toast.warning : toast.info;
        show(n.title, { description: n.body ?? undefined });
      }
    }).catch(() => undefined);
  });
  useLive(me ? [`client/${me}/messages`] : [], (event) => {
    if (event.kind !== 'message') return;
    const { text, title, body } = event.payload as { text?: string; title?: string; body?: string };
    toast.info(String(title ?? text ?? 'New message'), { description: title ? String(body ?? text ?? '') || undefined : body });
  });
  return null;
}

/** Where the app lives: `/portal` (signed-in clients) or `/embed/app` (SDK, in a frame). */
const BaseContext = createContext('/portal');
export const useAppBase = () => useContext(BaseContext);
export const BaseProvider = BaseContext.Provider;

/**
 * Runtime of the live app: navigation within the app, journeys started through the API — on their page, or over the
 * page (dialog, sheet, whole screen) as the journey or the button says (docs/plans/14).
 */
export function LiveRuntime({ app, base, children, onSignOut, onEvent, overlays = true }: {
  app: AppView;
  base: string;
  children: ReactNode;
  onSignOut?: () => void;
  onEvent?: AppRuntime['emit'];
  /** Journeys may open over the page (not in a frame that grows with its content). */
  overlays?: boolean;
}) {
  const navigate = useNavigate();
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [starting, setStarting] = useState<string | null>(null);
  const definition = app.definition!;
  const [overlay, setOverlay] = useState<JourneyOverlayState | null>(null);
  // Closing a journey open over the page: the page behind shows where things stand (waiting requests, balances).
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    void queryClient.invalidateQueries({ queryKey: ['client-app', 'data'] });
  }, [queryClient]);
  // Going to another page (links, the browser's Back) closes a journey open over the page.
  const { pathname } = useLocation();
  useEffect(() => setOverlay(null), [pathname]);

  /** How a journey opens: the button's choice, else the journey's, else its own page. */
  const presentationOf = useCallback((journey: string | null | undefined, override?: StartOptions['presentation']): JourneyPresentation => {
    const declared = journey ? definition.journeys[journey]?.presentation : undefined;
    const mode = (override || declared?.mode || 'page') as JourneyPresentation['mode'];
    return { ...declared, mode: overlays ? mode : 'page' };
  }, [definition.journeys, overlays]);
  const show = useCallback((caseId: string, journey: string | null, presentation: JourneyPresentation) => {
    if (presentation.mode === 'page') {
      setOverlay(null);
      navigate(`${base}/journeys/${caseId}`);
      window.scrollTo({ top: 0 });
    } else {
      setOverlay({ caseId, journey, presentation: presentation as JourneyOverlayState['presentation'] });
    }
  }, [navigate, base]);

  const openPage = useCallback((page: string, params: Record<string, string> = {}) => {
    if (page === '__requests') return navigate(`${base}/requests`);
    const query = new URLSearchParams(params).toString();
    navigate(page === definition.home && !query ? base : `${base}/p/${page}${query ? `?${query}` : ''}`);
    window.scrollTo({ top: 0 });
  }, [navigate, base, definition.home]);

  const startJourney = useCallback(async (journey: string, input: Record<string, unknown> = {}, options: StartOptions = {}) => {
    setStarting(journey);
    try {
      const { data } = await axios.post<JourneyState>(`${API_BASE_URL}/me/app/journeys/${journey}/start`, { input });
      followCase(data.case.id);
      queryClient.setQueryData(journeyKey(data.case.id), data);
      onEvent?.('journey.started', { journey, caseId: data.case.id, reference: data.case.reference });
      if (data.state === 'done') {
        onEvent?.('journey.completed', { journey, caseId: data.case.id, reference: data.case.reference, status: data.case.status, outcome: data.case.outcome });
        // One-tap journeys (freeze a card): no screen, just the result.
        await queryClient.invalidateQueries({ queryKey: ['client-app', 'data'] });
        const message = data.message;
        if (['approved', 'completed'].includes(data.case.status)) toast.success(message?.title ?? `${data.journey?.title ?? 'Done'}`, { description: message?.body ?? undefined });
        else toast.error(message?.title ?? data.case.statusLabel, { description: message?.body ?? undefined });
        return;
      }
      show(data.case.id, journey, presentationOf(journey, options.presentation));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setStarting(null);
    }
  }, [axios, queryClient, onEvent, show, presentationOf]);

  const runtime = useMemo<AppRuntime>(() => ({
    definition,
    institution: app.institution,
    mode: 'live',
    openPage,
    startJourney,
    starting,
    openCase: (caseId: string, journeyHint?: string | null) => {
      const cases = queryClient.getQueriesData<AppData>({ queryKey: ['client-app', 'data'] }).flatMap(([, d]) => d?.cases ?? []);
      const kase = cases.find((c) => c.id === caseId);
      // Applications made outside the app (forms, advisers) keep their classic page.
      if (kase && !kase.journey) {
        navigate(`${base}/cases/${caseId}`);
        window.scrollTo({ top: 0 });
      } else {
        const journey = kase?.journey ?? journeyHint ?? null;
        show(caseId, journey, presentationOf(journey));
      }
    },
    updateProfile: async (fields) => {
      await axios.patch(`${API_BASE_URL}/me/app/profile`, { fields });
      await queryClient.invalidateQueries({ queryKey: ['client-app', 'data'] });
    },
    signOut: onSignOut ?? (() => void logout()),
    emit: onEvent,
  }), [definition, app.institution, openPage, startJourney, starting, queryClient, navigate, base, axios, onSignOut, logout, onEvent, show, presentationOf]);

  return (
    <BaseContext.Provider value={base}>
      <RuntimeProvider runtime={runtime}>
        <LiveClientApp />
        {children}
        {overlay && <JourneyOverlay overlay={overlay} onClose={closeOverlay} />}
      </RuntimeProvider>
    </BaseContext.Provider>
  );
}

export { sourcesOf };
