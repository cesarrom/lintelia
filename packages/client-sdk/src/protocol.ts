/**
 * Messages between a host (your site, your mobile app) and the embedded client app (`<app>/embed/app`).
 * Both sides check where messages come from: the host only listens to its iframe (and the app's origin), the app only
 * to its parent window, and sends to the origin the host declared (which the institution must have allowed).
 */

/** Host → app. */
export type HostMessage =
  | { source: 'lintelia-sdk'; type: 'session'; clientSecret?: string; subjectToken?: string }
  | { source: 'lintelia-sdk'; type: 'navigate'; page: string; params?: Record<string, string> }
  | { source: 'lintelia-sdk'; type: 'start-journey'; journey: string; input?: Record<string, unknown> };

/** Events the app reports. */
export type AppEventName = 'journey.started' | 'journey.completed' | 'signed-out' | 'session.expired' | 'page.viewed';

export interface AppEvent {
  name: AppEventName;
  detail: Record<string, unknown>;
}

/** App → host. */
export type AppMessage =
  | { source: 'lintelia-app'; type: 'needs-session'; reason: 'start' | 'expired' }
  | { source: 'lintelia-app'; type: 'ready'; page: string }
  | { source: 'lintelia-app'; type: 'resize'; height: number }
  | { source: 'lintelia-app'; type: 'navigate'; page: string; params: Record<string, string> }
  | { source: 'lintelia-app'; type: 'event'; event: AppEvent }
  | { source: 'lintelia-app'; type: 'error'; message: string };

export const isAppMessage = (data: unknown): data is AppMessage =>
  !!data && typeof data === 'object' && (data as { source?: unknown }).source === 'lintelia-app' && typeof (data as { type?: unknown }).type === 'string';

export const isHostMessage = (data: unknown): data is HostMessage =>
  !!data && typeof data === 'object' && (data as { source?: unknown }).source === 'lintelia-sdk' && typeof (data as { type?: unknown }).type === 'string';

export interface EmbedUrlOptions {
  /** Where the institution's app is served, e.g. `https://app.your-bank.com`. */
  appUrl: string;
  /** Page to open first (default: the app's home page). */
  page?: string;
  params?: Record<string, string>;
  /** `full`: the app's own navigation; `none`: content only (your site navigates, the frame takes its content's height). */
  chrome?: 'full' | 'none';
  /** Origin of the host page (the app only talks to it). `react-native` for WebViews. */
  hostOrigin: string;
}

/** Address of the embedded app. */
export function embedUrl({ appUrl, page, params, chrome = 'full', hostOrigin }: EmbedUrlOptions) {
  const base = appUrl.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error('appUrl must be an http(s) address');
  const query = new URLSearchParams({ ...(params ?? {}), origin: hostOrigin, ...(chrome === 'none' ? { chrome } : {}) });
  const path = page ? `/embed/app/p/${encodeURIComponent(page)}` : '/embed/app';
  return `${base}${path}?${query.toString()}`;
}

export const originOf = (url: string) => new URL(url).origin;
