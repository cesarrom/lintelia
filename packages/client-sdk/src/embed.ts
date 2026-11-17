import { embedUrl, isAppMessage, originOf, type AppEvent, type AppMessage, type HostMessage } from './protocol';

export interface MountOptions {
  /** Where the institution's app is served, e.g. `https://app.your-bank.com` (its own domain, or the Fintivio host). */
  appUrl: string;
  /**
   * Returns a single-use client secret your backend obtained from `POST /client-sessions` (with its API credentials).
   * Called when the app starts and whenever its session ends.
   */
  fetchClientSecret?: () => Promise<string>;
  /** Alternatively, a token of your identity provider (the app must accept it: Settings → Identity → token exchange). */
  fetchSubjectToken?: () => Promise<string>;
  page?: string;
  params?: Record<string, string>;
  /** `full` (default): the app with its menu, in a frame of `height`; `none`: content only, the frame grows with it. */
  chrome?: 'full' | 'none';
  /** Frame height for `chrome: 'full'` (default 760px). */
  height?: number | string;
  title?: string;
  onReady?: (page: string) => void;
  onEvent?: (event: AppEvent) => void;
  onNavigate?: (page: string, params: Record<string, string>) => void;
  onError?: (error: Error) => void;
}

export interface EmbeddedApp {
  readonly iframe: HTMLIFrameElement;
  navigate(page: string, params?: Record<string, string>): void;
  startJourney(journey: string, input?: Record<string, unknown>): void;
  /** Ask for a new session (e.g. after your user switched accounts). */
  refreshSession(): Promise<void>;
  destroy(): void;
}

/**
 * Show the client app inside `target` (an element or a CSS selector). The app asks for a session when it needs one;
 * the SDK gets a client secret (or token) from your backend and hands it over. Messages are only exchanged with the
 * frame, at the app's origin.
 */
export function mount(target: HTMLElement | string, options: MountOptions): EmbeddedApp {
  const element = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!element) throw new Error(`Fintivio: no element matches ${String(target)}`);
  if (!options.fetchClientSecret && !options.fetchSubjectToken) throw new Error('Fintivio: fetchClientSecret or fetchSubjectToken is required');
  const doc = element.ownerDocument;
  const win = doc.defaultView!;
  const appOrigin = originOf(options.appUrl);
  const chrome = options.chrome ?? 'full';

  const iframe = doc.createElement('iframe');
  iframe.src = embedUrl({ appUrl: options.appUrl, page: options.page, params: options.params, chrome, hostOrigin: win.location.origin });
  iframe.title = options.title ?? 'Online banking';
  iframe.setAttribute('data-fintivio-app', '');
  iframe.allow = 'camera; clipboard-write';
  Object.assign(iframe.style, { width: '100%', border: '0', display: 'block', colorScheme: 'normal' });
  iframe.style.height = chrome === 'none' ? '480px' : typeof options.height === 'number' ? `${options.height}px` : options.height ?? '760px';
  element.appendChild(iframe);

  const send = (message: HostMessage) => iframe.contentWindow?.postMessage(message, appOrigin);

  const provideSession = async () => {
    try {
      if (options.fetchClientSecret) send({ source: 'fintivio-sdk', type: 'session', clientSecret: await options.fetchClientSecret() });
      else send({ source: 'fintivio-sdk', type: 'session', subjectToken: await options.fetchSubjectToken!() });
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== appOrigin || event.source !== iframe.contentWindow || !isAppMessage(event.data)) return;
    handle(event.data);
  };
  const handle = (message: AppMessage) => {
    switch (message.type) {
      case 'needs-session': return void provideSession();
      case 'ready': return options.onReady?.(message.page);
      case 'resize': if (chrome === 'none') iframe.style.height = `${Math.max(200, Math.ceil(message.height))}px`; return;
      case 'navigate': return options.onNavigate?.(message.page, message.params);
      case 'event': return options.onEvent?.(message.event);
      case 'error': return options.onError?.(new Error(message.message));
    }
  };
  win.addEventListener('message', onMessage);

  return {
    iframe,
    navigate: (page, params) => send({ source: 'fintivio-sdk', type: 'navigate', page, params }),
    startJourney: (journey, input) => send({ source: 'fintivio-sdk', type: 'start-journey', journey, input }),
    refreshSession: provideSession,
    destroy: () => {
      win.removeEventListener('message', onMessage);
      iframe.remove();
    },
  };
}
