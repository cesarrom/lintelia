import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { mount, type EmbeddedApp, type MountOptions } from './embed';
import { createClient, type ClientOptions, type LinteliaClient } from './client';

/**
 * React bindings: `<LinteliaApp>` embeds the hosted app; `<LinteliaProvider>` + hooks drive the API for your own screens.
 */

export interface LinteliaAppProps extends MountOptions {
  className?: string;
  style?: CSSProperties;
  /** Receives the controller (navigate, startJourney…). */
  onMount?: (app: EmbeddedApp) => void;
}

export function LinteliaApp({ className, style, onMount, ...options }: LinteliaAppProps) {
  const container = useRef<HTMLDivElement>(null);
  // Callbacks may change on every render; the frame must not be recreated for that.
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    if (!container.current) return;
    const app = mount(container.current, {
      ...latest.current,
      fetchClientSecret: latest.current.fetchClientSecret && (() => latest.current.fetchClientSecret!()),
      fetchSubjectToken: latest.current.fetchSubjectToken && (() => latest.current.fetchSubjectToken!()),
      onReady: (page) => latest.current.onReady?.(page),
      onEvent: (event) => latest.current.onEvent?.(event),
      onNavigate: (page, params) => latest.current.onNavigate?.(page, params),
      onError: (error) => latest.current.onError?.(error),
    });
    onMount?.(app);
    return () => app.destroy();
    // Recreate only when what the frame shows changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.appUrl, options.chrome, options.page, JSON.stringify(options.params ?? {})]);
  return <div ref={container} className={className} style={style} data-lintelia-host="" />;
}

const ClientContext = createContext<LinteliaClient | null>(null);

export function LinteliaProvider({ children, client, ...options }: { children: React.ReactNode; client?: LinteliaClient } & Partial<ClientOptions>) {
  const value = useMemo(() => client ?? createClient(options as ClientOptions), [client]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useLintelia(): LinteliaClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('LinteliaProvider is missing');
  return client;
}

interface Resource<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refresh: () => Promise<void>;
}

function useResource<T>(load: (client: LinteliaClient) => Promise<T>, deps: unknown[]): Resource<T> {
  const client = useLintelia();
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await load(client), loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error: error as Error, loading: false }));
    }
  }, [client, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void refresh(); }, [refresh]);
  return { data: state.data, error: state.error, loading: state.loading, refresh };
}

/** Data the app declares (`me`, `records:accounts`, `journeys`…), read as the signed-in client. */
export const useAppData = <T = Record<string, unknown>>(sources: string[]) => useResource<T>((c) => c.data<T>(sources), [sources.join(',')]);

/** A journey's state (screen to fill, waiting, done). */
export const useJourney = <T = unknown>(caseId: string | null) => useResource<T | null>((c) => (caseId ? c.journey<T>(caseId) : Promise.resolve(null)), [caseId]);
