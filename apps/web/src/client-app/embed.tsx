import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { isHostMessage, type AppMessage, type HostMessage } from '@lintelia/client-sdk/protocol';
import { API_BASE_URL, useAuthActions, useSession, type StoredSession } from '@/lib/auth/session';
import { useDomain } from '@/lib/providers/TenantProvider';
import { LogoMark } from '@/components/brand/Logo';
import { useClientApp } from './app-query';
import { AppShell } from './AppShell';
import { LiveRuntime } from './live';
import { PageSkeleton } from './pages';
import { useRuntime, type AppRuntime } from './runtime';

/**
 * The client app embedded in the institution's site or mobile app (`/embed/app`, docs/plans/11 §13 decision 4), driven
 * by `@lintelia/client-sdk`:
 *  - the host says who it is (`?origin=`); the app only talks to it if the institution allowed that site (embedding
 *    settings, also enforced by the frame-ancestors policy), or to the WebView bridge of a mobile app;
 *  - without a session the app asks the host for one; the host gets a single-use client secret from its backend
 *    (`POST /client-sessions`) or passes a token of its identity provider, which the app exchanges;
 *  - the app reports its height (content-only mode), the page shown and events (journey started / completed…).
 */
export const EMBED_BASE = '/embed/app';

interface NativeBridge { postMessage: (message: string) => void }
const nativeBridge = () => (window as unknown as { ReactNativeWebView?: NativeBridge }).ReactNativeWebView ?? null;

export default function EmbedAppFrame() {
  const location = useLocation();
  const navigate = useNavigate();
  const domain = useDomain();
  const { session, isAuthenticated } = useSession();
  const { adopt, logout } = useAuthActions();
  // What the host declared, read once (then removed from the address: they are not page parameters).
  const [host] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return { origin: params.get('origin') ?? '', chrome: params.get('chrome') === 'none' ? 'none' as const : 'full' as const };
  });
  const [trusted, setTrusted] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('origin') || params.has('chrome')) {
      params.delete('origin');
      params.delete('chrome');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Is the host allowed to embed the app?
  useEffect(() => {
    if (nativeBridge() && host.origin === 'react-native') return setTrusted(true);
    if (window.parent === window) return setTrusted(host.origin === '' || host.origin === window.location.origin);
    fetch(`${API_BASE_URL}/auth/client/embed-policy`, { headers: { 'X-Tenant': domain } })
      .then((r) => r.json())
      .then((policy: { frameAncestors?: string[] }) => setTrusted(host.origin === window.location.origin || (policy.frameAncestors ?? []).includes(host.origin)))
      .catch(() => setTrusted(false));
  }, [domain, host.origin]);

  const post = useCallback((message: Omit<AppMessage, 'source'> & { type: AppMessage['type'] }) => {
    const full = { source: 'lintelia-app', ...message } as AppMessage;
    const bridge = nativeBridge();
    if (bridge) return bridge.postMessage(JSON.stringify(full));
    if (trusted && window.parent !== window && host.origin) window.parent.postMessage(full, host.origin);
  }, [trusted, host.origin]);

  const exchange = useCallback(async (message: Extract<HostMessage, { type: 'session' }>) => {
    setExchanging(true);
    setProblem(null);
    try {
      const path = message.clientSecret ? '/auth/client/session' : '/auth/client/token';
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant': domain },
        body: JSON.stringify(message.clientSecret ? { clientSecret: message.clientSecret } : { subjectToken: message.subjectToken }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Sign-in failed');
      adopt(body as StoredSession);
      setSignedOut(false);
      asked.current = false;
    } catch (error) {
      const text = (error as Error).message;
      setProblem(text);
      post({ type: 'error', message: text } as never);
    } finally {
      setExchanging(false);
    }
  }, [domain, adopt, post]);

  // A session handed over in the address (`#cs=…` or `#token=…`): mobile apps that prefer it to messages.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const clientSecret = hash.get('cs');
    const subjectToken = hash.get('token');
    if (clientSecret || subjectToken) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      void exchange({ source: 'lintelia-sdk', type: 'session', clientSecret: clientSecret ?? undefined, subjectToken: subjectToken ?? undefined });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Messages of the host: only from the parent window (or this window in a WebView), at the declared origin.
  const [command, setCommand] = useState<HostMessage | null>(null);
  useEffect(() => {
    if (!trusted) return;
    const onMessage = (event: MessageEvent) => {
      const fromParent = window.parent !== window && event.source === window.parent && event.origin === host.origin;
      const fromNative = !!nativeBridge() && event.source === window && event.origin === window.location.origin;
      if (!(fromParent || fromNative) || !isHostMessage(event.data)) return;
      if (event.data.type === 'session') void exchange(event.data);
      else setCommand(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [trusted, host.origin, exchange]);

  // No session: ask the host for one (once per loss).
  useEffect(() => {
    if (!trusted || isAuthenticated || exchanging || signedOut || asked.current) return;
    asked.current = true;
    post({ type: 'needs-session', reason: session === null && !window.sessionStorage.length ? 'start' : 'expired' } as never);
  }, [trusted, isAuthenticated, exchanging, signedOut, post, session]);

  if (trusted === false) return <Notice icon="blocked" title="This site may not show the app" text="Ask the institution to add this site to the app's embedding settings." />;
  if (signedOut) return <Notice icon="signed-out" title="You are signed out" text="Sign in again on the site to continue." />;
  if (problem && !isAuthenticated) return <Notice icon="blocked" title="We could not sign you in" text={problem} />;
  if (!isAuthenticated || trusted === null) return <Notice icon="loading" title="Signing you in…" />;
  if (session?.user.kind !== 'client') return <Notice icon="blocked" title="Clients only" text="The embedded app is for the institution's clients." />;
  return (
    <EmbeddedApp
      chrome={host.chrome} post={post} command={command} onCommandDone={() => setCommand(null)}
      onSignOut={async () => {
        await logout();
        setSignedOut(true);
        post({ type: 'event', event: { name: 'signed-out', detail: {} } } as never);
      }}
    />
  );
}

function EmbeddedApp({ chrome, post, command, onCommandDone, onSignOut }: {
  chrome: 'full' | 'none';
  post: (message: never) => void;
  command: HostMessage | null;
  onCommandDone: () => void;
  onSignOut: () => void;
}) {
  const { data: app, isLoading } = useClientApp();
  const onEvent = useCallback<NonNullable<AppRuntime['emit']>>((name, detail) => post({ type: 'event', event: { name, detail } } as never), [post]);
  if (isLoading) return <Notice icon="loading" title="Loading…" />;
  if (!app?.available) return <Notice icon="blocked" title="Not available" text="This institution has not published its app yet." />;
  return (
    <LiveRuntime app={app} base={EMBED_BASE} onSignOut={onSignOut} onEvent={onEvent} overlays={chrome !== 'none'}>
      <Bridge chrome={chrome} post={post} command={command} onCommandDone={onCommandDone} />
      <AppShell embedded chrome={chrome}>
        <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
      </AppShell>
    </LiveRuntime>
  );
}

/** Reports page views and height to the host; runs its commands (navigate, start a journey). */
function Bridge({ chrome, post, command, onCommandDone }: { chrome: 'full' | 'none'; post: (message: never) => void; command: HostMessage | null; onCommandDone: () => void }) {
  const runtime = useRuntime();
  const location = useLocation();
  const ready = useRef(false);
  const page = useMemo(() => location.pathname.match(/\/p\/([^/]+)/)?.[1] ?? (location.pathname.includes('/journeys/') ? 'journey' : runtime.definition.home), [location.pathname, runtime.definition.home]);

  useEffect(() => {
    const params = Object.fromEntries(new URLSearchParams(location.search));
    if (!ready.current) {
      ready.current = true;
      post({ type: 'ready', page } as never);
    }
    post({ type: 'navigate', page, params } as never);
    post({ type: 'event', event: { name: 'page.viewed', detail: { page, params } } } as never);
  }, [page, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chrome !== 'none') return;
    const report = () => post({ type: 'resize', height: document.documentElement.scrollHeight } as never);
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    report();
    return () => observer.disconnect();
  }, [chrome, post]);

  useEffect(() => {
    if (!command) return;
    if (command.type === 'navigate') runtime.openPage(command.page, command.params ?? {});
    if (command.type === 'start-journey') void runtime.startJourney(command.journey, command.input ?? {});
    onCommandDone();
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Notice({ icon, title, text }: { icon: 'loading' | 'blocked' | 'signed-out'; title: string; text?: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center" data-testid="embed-notice" data-kind={icon}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon === 'loading' ? <Loader2 className="h-6 w-6 animate-spin" /> : icon === 'signed-out' ? <LogOut className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
      </span>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><LogoMark className="h-3.5 w-3.5" />Secured by lintelia</p>
    </div>
  );
}
