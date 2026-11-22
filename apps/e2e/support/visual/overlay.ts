/**
 * In-page overlay of the e2e visual mode, injected as an init script into every page and frame of every browser
 * context (support/visual/runtime.ts). It only draws; it never changes what the tests see:
 *
 *  - lives in a CLOSED shadow root on <html>, outside <body>: Playwright locators, React roots, Radix focus traps and
 *    aria-hidden walkers never see it;
 *  - `pointer-events: none` everywhere: hit-testing (and Playwright's "element receives events" check) ignores it;
 *  - styles via constructable stylesheets and CSSOM only: allowed by strict Content-Security-Policies;
 *  - no storage writes, no globals other than a guard flag.
 *
 * What it shows: a cursor that follows the (real, CDP-dispatched) mouse, a ripple on each press, a glow on fields as
 * they are filled, and — in the top frame — a heads-up display with the running test, the step in progress and the
 * persona signed in to this window. State comes from the runner through the `__linteliaE2eVisual` binding.
 */
export const VISUAL_BINDING = '__linteliaE2eVisual';

export interface OverlayOptions {
  binding: string;
  hud: boolean;
  sessionKey: string;
  /** Size of the overlay's text relative to 12 px: larger when windows are drawn scaled down. */
  textScale: number;
}

/** Serialised by Playwright and evaluated in the page before any of its scripts: must be self-contained. */
export function installOverlay(options: OverlayOptions) {
  const w = window as any;
  if (w.__linteliaE2eOverlay) return;
  w.__linteliaE2eOverlay = true;

  const isTop = window === window.top;
  /** Is this window the one in use? (Updated from the runner's state and from input events.) */
  let focusedNow = false;
  const call = (...args: unknown[]): Promise<any> | undefined => {
    const fn = w[options.binding];
    if (typeof fn !== 'function') return undefined;
    try {
      return Promise.resolve(fn(...args)).catch(() => undefined);
    } catch {
      return undefined;
    }
  };

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; overflow: hidden;
      font: ${12 * options.textScale}px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .active-frame { position: absolute; inset: 0; border: .3em solid transparent; transition: border-color .25s; }
    .active-frame.on { border-color: rgba(99, 102, 241, .85); }
    .cursor { position: absolute; left: 0; top: 0; width: 1.8em; height: 1.8em; margin: -.9em 0 0 -.9em; border-radius: 50%;
      background: rgba(239, 68, 68, .35); border: .17em solid rgba(255, 255, 255, .95);
      box-shadow: 0 0 0 1px rgba(239, 68, 68, .9), 0 2px 8px rgba(0, 0, 0, .35);
      transition: transform .14s cubic-bezier(.2, .8, .2, 1), opacity .3s; opacity: 0; }
    .cursor.down { background: rgba(239, 68, 68, .75); }
    .ripple { position: absolute; width: 3.6em; height: 3.6em; margin: -1.8em 0 0 -1.8em; border-radius: 50%;
      border: .25em solid rgba(239, 68, 68, .9); animation: ripple .6s ease-out forwards; }
    @keyframes ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
    .glow { position: absolute; border-radius: 6px; box-shadow: 0 0 0 .25em rgba(16, 185, 129, .9), 0 0 1.3em rgba(16, 185, 129, .6);
      animation: glow .9s ease-out forwards; }
    @keyframes glow { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
    .hud { position: absolute; left: .8em; bottom: .8em; max-width: min(64em, calc(100vw - 1.6em)); padding: .65em 1em .75em;
      border-radius: .8em; color: #e2e8f0; background: rgba(15, 23, 42, .9);
      box-shadow: 0 8px 30px rgba(0, 0, 0, .35), inset 0 0 0 1px rgba(148, 163, 184, .25); opacity: .96; }
    .hud.hidden { display: none; }
    .hud.pos-br { left: auto; right: .8em; }
    .hud.pos-tr { left: auto; right: .8em; bottom: auto; top: .8em; }
    .hud.pos-tl { bottom: auto; top: .8em; }
    .hud.compact { padding: .35em .8em .4em; opacity: .9; }
    .hud.compact .full { display: none; }
    .row { display: flex; gap: .65em; align-items: baseline; white-space: nowrap; overflow: hidden; }
    .row + .row { margin-top: .25em; }
    .ellipsis { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .pill { flex: none; padding: .08em .6em; border-radius: 999px; font-size: .83em; font-weight: 700; letter-spacing: .04em;
      text-transform: uppercase; }
    .live { background: #ef4444; color: white; }
    .live::before { content: ""; display: inline-block; width: .5em; height: .5em; margin-right: .45em; border-radius: 50%;
      background: white; vertical-align: .08em; }
    .hook { background: #f59e0b; color: #111827; }
    .muted { color: #94a3b8; }
    .title { color: #f8fafc; font-weight: 600; font-size: 1.08em; }
    .step { color: #a5b4fc; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .96em; }
    .who { color: #6ee7b7; }
  `;

  let layer: HTMLElement;
  let cursor: HTMLElement;
  let activeFrame: HTMLElement;
  let hud: HTMLElement | undefined;
  const fields: Record<string, HTMLElement> = {};

  function build() {
    const host = document.createElement('lintelia-e2e-overlay');
    host.style.setProperty('all', 'initial');
    host.style.setProperty('position', 'fixed');
    host.style.setProperty('inset', '0');
    host.style.setProperty('pointer-events', 'none');
    host.style.setProperty('z-index', '2147483647');
    const root = host.attachShadow({ mode: 'closed' });
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      (root as any).adoptedStyleSheets = [sheet];
    } catch {
      const style = document.createElement('style');
      style.textContent = css;
      root.appendChild(style);
    }
    layer = document.createElement('div');
    layer.className = 'layer';
    activeFrame = document.createElement('div');
    activeFrame.className = 'active-frame';
    cursor = document.createElement('div');
    cursor.className = 'cursor';
    layer.append(activeFrame, cursor);
    if (isTop && options.hud) {
      hud = document.createElement('div');
      hud.className = 'hud hidden';
      const row = (...cells: Array<[string, string]>) => {
        const r = document.createElement('div');
        r.className = cells[0][0] === 'who' ? 'row' : 'row full';
        for (const [name, cls] of cells) {
          const span = document.createElement('span');
          span.className = cls;
          fields[name] = span;
          r.appendChild(span);
        }
        return r;
      };
      hud.append(
        row(['badge', 'pill live'], ['phase', 'pill hook'], ['where', 'muted ellipsis']),
        row(['title', 'title ellipsis']),
        row(['step', 'step ellipsis']),
        row(['who', 'who ellipsis']),
      );
      layer.appendChild(hud);
    }
    root.appendChild(layer);
    return host;
  }

  let host: HTMLElement | undefined;
  function mount() {
    if (!document.documentElement) return;
    if (!host) host = build();
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  // --- pointer and typing feedback (every frame) -----------------------------------------------------------------
  let lastActive = 0;
  const markActive = () => {
    const now = Date.now();
    if (now - lastActive < 400) return;
    lastActive = now;
    void call('active');
    focusedNow = true;
  };
  const moveCursor = (x: number, y: number) => {
    mount();
    if (!cursor) return;
    cursor.style.setProperty('opacity', '1');
    cursor.style.setProperty('transform', `translate(${x}px, ${y}px)`);
  };
  addEventListener('mousemove', (e) => { moveCursor(e.clientX, e.clientY); markActive(); }, { capture: true, passive: true });
  addEventListener('mousedown', (e) => {
    moveCursor(e.clientX, e.clientY);
    cursor?.classList.add('down');
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.setProperty('left', `${e.clientX}px`);
    ripple.style.setProperty('top', `${e.clientY}px`);
    layer?.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
    markActive();
  }, { capture: true, passive: true });
  addEventListener('mouseup', () => cursor?.classList.remove('down'), { capture: true, passive: true });
  const glow = (target: EventTarget | null) => {
    if (!(target instanceof Element) || !layer) return;
    const r = target.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const box = document.createElement('div');
    box.className = 'glow';
    box.style.setProperty('left', `${r.left - 2}px`);
    box.style.setProperty('top', `${r.top - 2}px`);
    box.style.setProperty('width', `${r.width + 4}px`);
    box.style.setProperty('height', `${r.height + 4}px`);
    layer.appendChild(box);
    setTimeout(() => box.remove(), 950);
    markActive();
  };
  addEventListener('input', (e) => glow(e.target), { capture: true, passive: true });
  addEventListener('change', (e) => glow(e.target), { capture: true, passive: true });
  addEventListener('keydown', markActive, { capture: true, passive: true });

  // --- heads-up display (top frame) ---------------------------------------------------------------------------------
  function persona() {
    try {
      const raw = localStorage.getItem(options.sessionKey);
      if (!raw) return '';
      const s = JSON.parse(raw);
      const email: string = s.user?.email ?? '';
      const roles: string[] = (s.user?.userTenants ?? []).flatMap((t: any) => t.roleNames ?? []);
      const role = s.user?.kind === 'staff' ? 'platform staff' : s.user?.kind === 'client' ? 'client' : roles.join(', ').replace(/_/g, ' ');
      // Generated test names repeat the e-mail's local part ("rm.70fee7a0"): show a name only when it says more.
      const name: string = s.user?.name && !email.startsWith(s.user.name) ? s.user.name : '';
      return [role, name, email].filter(Boolean).join(' · ');
    } catch {
      return '';
    }
  }

  // Keep the HUD off the element the test is about to use (and off the cursor): try the four corners in turn.
  const POSITIONS = ['', 'pos-br', 'pos-tr', 'pos-tl'];
  let position = 0;
  const intersects = (a: DOMRect, b: { x: number; y: number; width: number; height: number }, margin = 8) =>
    a.left - margin < b.x + b.width && b.x < a.right + margin && a.top - margin < b.y + b.height && b.y < a.bottom + margin;
  function dodge(target: { x: number; y: number; width: number; height: number } | undefined) {
    if (!hud || !target) return;
    if (!intersects(hud.getBoundingClientRect(), target)) return;
    const { width, height } = hud.getBoundingClientRect();
    const m = 12 * options.textScale * 0.8;
    const rectAt = (i: number) => {
      const right = i === 1 || i === 2;
      const top = i === 2 || i === 3;
      const x = right ? innerWidth - m - width : m;
      const y = top ? m : innerHeight - m - height;
      return new DOMRect(x, y, width, height);
    };
    for (let step = 1; step < POSITIONS.length; step++) {
      const next = (position + step) % POSITIONS.length;
      if (!intersects(rectAt(next), target)) {
        if (POSITIONS[position]) hud.classList.remove(POSITIONS[position]);
        position = next;
        if (POSITIONS[position]) hud.classList.add(POSITIONS[position]);
        return;
      }
    }
  }
  addEventListener('mousemove', (e) => dodge({ x: e.clientX - 20, y: e.clientY - 20, width: 40, height: 40 }), { capture: true, passive: true });

  const set = (name: string, text: string) => {
    const el = fields[name];
    if (el && el.textContent !== text) el.textContent = text;
    if (el) el.style.setProperty('display', text ? '' : 'none');
  };

  async function refresh() {
    mount();
    const state = await call('state');
    if (!state) return;
    const focused = !!state.active || state.windows <= 1;
    focusedNow = focused;
    activeFrame?.classList.toggle('on', !!state.active && isTop && state.windows > 1);
    if (!hud) return;
    hud.classList.toggle('hidden', !state.title);
    // Only the window in use narrates the test; the others just say who is signed in there.
    hud.classList.toggle('compact', !focused);
    set('badge', state.lane ? `live · lane ${state.lane}` : 'live');
    set('phase', state.phase && state.phase !== 'test' ? state.phase : '');
    set('where', state.where ?? '');
    set('title', state.title ?? '');
    set('step', state.step ? `▶ ${state.step}` : '');
    const who = persona();
    set('who', who ? `👤 ${who}` : `👤 not signed in · ${location.host}`);
    if (focused) dodge(state.target);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  // Poll the runner for what to show: often in the window in use, rarely in the others (every poll is a round trip
  // through Playwright, and software-rendered windows are not free).
  if (isTop && options.hud) {
    const tick = () => { void refresh().catch(() => { }).finally(() => setTimeout(tick, focusedNow ? 250 : 1000)); };
    tick();
  } else if (isTop) {
    const tick = () => {
      void (call('state') ?? Promise.resolve(undefined))
        .then((s) => { focusedNow = !!s?.active; activeFrame?.classList.toggle('on', !!s?.active && s.windows > 1); })
        .finally(() => setTimeout(tick, focusedNow ? 400 : 1000));
    };
    tick();
  }
}
