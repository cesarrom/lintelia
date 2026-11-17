/** The run monitor's page (served by monitor.ts): one self-contained HTML document, updated over Server-Sent Events. */
export function monitorPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fintivio e2e · live run</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; --bg: #0b1020; --panel: #111831; --line: #1f2a4a; --text: #e2e8f0; --muted: #8b97b5;
    --ok: #34d399; --bad: #f87171; --warn: #fbbf24; --ui: #a78bfa; --api: #22d3ee; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { background: var(--bg); color: var(--text); font: 12px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    display: flex; flex-direction: column; padding: 10px 12px; gap: 8px; overflow: hidden; }
  header { display: flex; align-items: center; gap: 10px; }
  .brand { font-weight: 700; font-size: 13px; letter-spacing: .01em; }
  .pill { padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .live { background: #ef4444; color: white; }
  .live::before { content: ""; display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%;
    background: white; vertical-align: 1px; }
  .passed-all { background: var(--ok); color: #052e1c; }
  .failed-all { background: var(--bad); color: #3b0a0a; }
  .spacer { flex: 1; }
  .clock { font-variant-numeric: tabular-nums; color: var(--muted); }
  .counts { display: flex; gap: 10px; font-variant-numeric: tabular-nums; font-weight: 600; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .warn { color: var(--warn); } .muted { color: var(--muted); }
  .bar { position: relative; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; display: flex; }
  .bar > span { height: 100%; transition: width .4s ease; }
  .bar .p { background: var(--ok); } .bar .f { background: var(--bad); } .bar .s { background: #475569; } .bar .r { background: #6366f1; opacity: .6; }
  h2 { margin: 2px 0 0; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
  .running { display: grid; gap: 6px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 9px; min-width: 0; }
  .line { display: flex; gap: 8px; align-items: baseline; min-width: 0; white-space: nowrap; }
  .ellipsis { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .tag { flex: none; font-size: 9.5px; font-weight: 800; padding: 0 6px; border-radius: 4px; letter-spacing: .05em; text-transform: uppercase; }
  .tag.ui { background: rgba(167, 139, 250, .18); color: var(--ui); } .tag.api { background: rgba(34, 211, 238, .14); color: var(--api); }
  .title { font-weight: 600; flex: 1; }
  .secs { flex: none; color: var(--muted); font-variant-numeric: tabular-nums; }
  .step { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #a5b4fc; }
  .feed { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
  .row { display: flex; gap: 8px; align-items: baseline; white-space: nowrap; padding: 1px 2px; min-width: 0; }
  .row .icon { flex: none; width: 12px; text-align: center; font-weight: 800; }
  .row.failed { background: rgba(248, 113, 113, .08); border-radius: 4px; }
  .err { color: #fca5a5; font-size: 11px; }
  .empty { color: var(--muted); font-style: italic; }
</style>
</head>
<body>
  <header>
    <span id="badge" class="pill live">live</span>
    <span class="brand">Fintivio e2e</span>
    <span class="spacer"></span>
    <span class="counts"><span class="ok" id="passed">✓ 0</span><span class="bad" id="failed">✘ 0</span><span class="warn" id="flaky"></span><span class="muted" id="skipped"></span><span class="muted" id="total">/ 0</span></span>
    <span class="clock" id="clock">00:00</span>
  </header>
  <div class="bar"><span class="p" id="bp"></span><span class="f" id="bf"></span><span class="s" id="bs"></span><span class="r" id="br"></span></div>
  <h2 id="running-title">Running now</h2>
  <div class="running" id="running"></div>
  <h2>Results</h2>
  <div class="feed" id="feed"><div class="empty">Waiting for the first result…</div></div>
<script>
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const secs = (ms) => ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s';
  const ICON = { passed: ['✓', 'ok'], failed: ['✘', 'bad'], timedOut: ['⏱', 'bad'], interrupted: ['■', 'bad'], skipped: ['↷', 'muted'], flaky: ['≈', 'warn'] };
  let state = null;

  function tag(project) { return el('span', 'tag ' + (project === 'ui' ? 'ui' : 'api'), project || '—'); }

  function render() {
    if (!state) return;
    const c = state.counts, total = Math.max(1, state.total);
    $('passed').textContent = '✓ ' + c.passed;
    $('failed').textContent = '✘ ' + c.failed;
    $('flaky').textContent = c.flaky ? '≈ ' + c.flaky : '';
    $('skipped').textContent = c.skipped ? '↷ ' + c.skipped : '';
    $('total').textContent = c.done + ' / ' + state.total;
    $('bp').style.width = (c.passed + c.flaky) / total * 100 + '%';
    $('bf').style.width = c.failed / total * 100 + '%';
    $('bs').style.width = c.skipped / total * 100 + '%';
    $('br').style.width = state.running.length / total * 100 + '%';
    const badge = $('badge');
    if (state.finished) {
      const ok = state.finished.status === 'passed';
      badge.className = 'pill ' + (ok ? 'passed-all' : 'failed-all');
      badge.textContent = ok ? 'passed' : state.finished.status;
      document.title = (ok ? '✓ ' : '✘ ') + 'Fintivio e2e · ' + c.passed + ' passed, ' + c.failed + ' failed';
    }

    const running = $('running');
    running.replaceChildren();
    $('running-title').textContent = state.finished ? 'Finished in ' + mmss(state.finished.duration) : 'Running now · ' + state.running.length;
    for (const r of state.running) {
      const card = el('div', 'card');
      const top = el('div', 'line');
      top.append(tag(r.project), el('span', 'title ellipsis', r.title), el('span', 'secs', mmss(Date.now() - r.startedAt)));
      const mid = el('div', 'line muted');
      mid.append(el('span', 'ellipsis', r.file + (r.where ? ' › ' + r.where : '')));
      card.append(top, mid);
      if (r.step) { const s = el('div', 'line step'); s.append(el('span', 'ellipsis', '▶ ' + r.step)); card.append(s); }
      running.append(card);
    }

    const feed = $('feed');
    const rows = [...state.failures.slice().reverse(), ...state.recent.filter((r) => !state.failures.some((f) => f.id === r.id))];
    if (!rows.length) return;
    feed.replaceChildren();
    for (const r of rows) {
      const [icon, cls] = ICON[r.status] || ['?', 'muted'];
      const failed = cls === 'bad';
      const row = el('div', 'row' + (failed ? ' failed' : ''));
      row.append(el('span', 'icon ' + cls, icon), tag(r.project), el('span', 'title ellipsis', r.title), el('span', 'secs', secs(r.duration)));
      feed.append(row);
      if (failed && r.error) { const e = el('div', 'row err'); e.append(el('span', 'icon', ''), el('span', 'ellipsis', r.error)); feed.append(e); }
    }
  }

  function connect() {
    const source = new EventSource('/events');
    source.onmessage = (e) => { state = JSON.parse(e.data); render(); };
    source.onerror = () => { if (state && state.finished) source.close(); };
  }
  setInterval(() => {
    if (!state) return;
    $('clock').textContent = mmss((state.finished ? state.startedAt + state.finished.duration : Date.now()) - state.startedAt);
    if (!state.finished) for (const [i, r] of state.running.entries()) {
      const s = document.querySelectorAll('#running .card .secs')[i]; if (s) s.textContent = mmss(Date.now() - r.startedAt);
    }
  }, 1000);
  connect();
</script>
</body>
</html>`;
}
