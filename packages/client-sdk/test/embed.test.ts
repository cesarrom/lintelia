import { describe, expect, mock, test } from 'bun:test';

// jsdom probes the optional native `canvas` package, which is not built here.
mock.module('canvas', () => ({}));
const { JSDOM } = await import('jsdom');
import { embedUrl, isAppMessage } from '../src/protocol';
import { mount } from '../src/embed';

const APP = 'https://app.bank.example';

function page() {
  const dom = new JSDOM('<!doctype html><div id="host"></div>', { url: 'https://www.bank.example/online-banking' });
  const { window } = dom;
  const host = window.document.getElementById('host')!;
  /** A message as the app in the frame would send it. */
  const fromApp = (iframe: HTMLIFrameElement, data: unknown, origin = APP, source: unknown = iframe.contentWindow) =>
    window.dispatchEvent(new window.MessageEvent('message', { data, origin, source: source as never }));
  return { window, host, fromApp };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('embed URL', () => {
  test('points at the embedded app with the host origin', () => {
    expect(embedUrl({ appUrl: `${APP}/`, hostOrigin: 'https://www.bank.example' })).toBe(`${APP}/embed/app?origin=https%3A%2F%2Fwww.bank.example`);
    expect(embedUrl({ appUrl: APP, page: 'cards', params: { key: 'c1' }, chrome: 'none', hostOrigin: 'react-native' }))
      .toBe(`${APP}/embed/app/p/cards?key=c1&origin=react-native&chrome=none`);
  });

  test('refuses other schemes', () => {
    expect(() => embedUrl({ appUrl: 'javascript:alert(1)', hostOrigin: 'x' })).toThrow();
  });

  test('recognises app messages only', () => {
    expect(isAppMessage({ source: 'fintivio-app', type: 'ready' })).toBe(true);
    expect(isAppMessage({ source: 'other', type: 'ready' })).toBe(false);
    expect(isAppMessage('ready')).toBe(false);
  });
});

describe('mount', () => {
  test('adds the frame and hands over a session when the app asks', async () => {
    const { host, fromApp } = page();
    const secrets: string[] = [];
    const app = mount(host, { appUrl: APP, fetchClientSecret: async () => { secrets.push('cs_1'); return 'cs_1'; } });
    expect(app.iframe.src).toBe(`${APP}/embed/app?origin=https%3A%2F%2Fwww.bank.example`);
    expect(app.iframe.style.height).toBe('760px');
    const sent: Array<[unknown, string]> = [];
    (app.iframe.contentWindow as unknown as { postMessage: (m: unknown, o: string) => void }).postMessage = (message, origin) => sent.push([message, origin]);

    fromApp(app.iframe, { source: 'fintivio-app', type: 'needs-session', reason: 'start' });
    await tick();
    expect(secrets).toEqual(['cs_1']);
    expect(sent).toEqual([[{ source: 'fintivio-sdk', type: 'session', clientSecret: 'cs_1' }, APP]]);
  });

  test('ignores messages from other origins or other frames', async () => {
    const { window, host, fromApp } = page();
    let calls = 0;
    const app = mount(host, { appUrl: APP, fetchClientSecret: async () => { calls++; return 'x'; } });
    fromApp(app.iframe, { source: 'fintivio-app', type: 'needs-session', reason: 'start' }, 'https://evil.example');
    fromApp(app.iframe, { source: 'fintivio-app', type: 'needs-session', reason: 'start' }, APP, window);
    await tick();
    expect(calls).toBe(0);
  });

  test('reports events and navigation; resizes content-only frames', () => {
    const { host, fromApp } = page();
    const events: unknown[] = [];
    const app = mount(host, {
      appUrl: APP, chrome: 'none', fetchClientSecret: async () => 'x',
      onEvent: (e) => events.push(e), onNavigate: (p, params) => events.push({ p, params }), onReady: (p) => events.push({ ready: p }),
    });
    fromApp(app.iframe, { source: 'fintivio-app', type: 'ready', page: 'home' });
    fromApp(app.iframe, { source: 'fintivio-app', type: 'resize', height: 1234.2 });
    fromApp(app.iframe, { source: 'fintivio-app', type: 'navigate', page: 'cards', params: {} });
    fromApp(app.iframe, { source: 'fintivio-app', type: 'event', event: { name: 'journey.completed', detail: { journey: 'transfer' } } });
    expect(app.iframe.style.height).toBe('1235px');
    expect(events).toEqual([{ ready: 'home' }, { p: 'cards', params: {} }, { name: 'journey.completed', detail: { journey: 'transfer' } }]);
  });

  test('sends navigation and journeys to the app; destroy removes the frame', () => {
    const { host, fromApp } = page();
    let asked = 0;
    const app = mount(host, { appUrl: APP, fetchClientSecret: async () => { asked++; return 'x'; } });
    const sent: unknown[] = [];
    (app.iframe.contentWindow as unknown as { postMessage: (m: unknown) => void }).postMessage = (m) => sent.push(m);
    app.navigate('account', { key: 'cur-1' });
    app.startJourney('card_freeze', { card: 'c1' });
    expect(sent).toEqual([
      { source: 'fintivio-sdk', type: 'navigate', page: 'account', params: { key: 'cur-1' } },
      { source: 'fintivio-sdk', type: 'start-journey', journey: 'card_freeze', input: { card: 'c1' } },
    ]);
    const iframe = app.iframe;
    app.destroy();
    expect(host.querySelector('iframe')).toBeNull();
    fromApp(iframe, { source: 'fintivio-app', type: 'needs-session', reason: 'expired' });
    expect(asked).toBe(0);
  });

  test('needs a way to get a session', () => {
    const { host } = page();
    expect(() => mount(host, { appUrl: APP })).toThrow(/fetchClientSecret/);
  });
});
