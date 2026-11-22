// Headed-browser probe for the e2e visual mode (support/visual/detect.ts runs it in a child process).
//
//   node probe.mjs '{"executablePath": "...", "scale": 0.5}'
//
// Launches the browser WITH a window (parked off-screen, closed at once) and prints one JSON line:
//   {"ok": true, "screen": {"width", "height", "availWidth", "availHeight", "availLeft", "availTop", "dpr"},
//    "insets": {"width", "height"}, "version"}
// `insets` is what the window frame, tab strip and toolbar add to the page area, in device-independent pixels, at
// `scale` (the toolbar does not shrink linearly, so it is measured rather than assumed).
//   {"ok": false, "error": "..."}
// A launch that works here proves a display, its authorisation and the browser's GUI libraries are all usable.
import { chromium } from '@playwright/test';

const options = JSON.parse(process.argv[2] ?? '{}');
const done = (result) => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
};
setTimeout(() => done({ ok: false, error: 'timed out launching a headed browser' }), 20_000).unref();

let result;
try {
  const browser = await chromium.launch({
    headless: false,
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
    args: [
      '--window-position=-4000,-4000',
      '--window-size=900,700',
      ...(options.scale ? [`--force-device-scale-factor=${options.scale}`] : []),
    ],
    timeout: 15_000,
  });
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    const { screen, insets } = await page.evaluate(() => ({ screen: {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      // Non-standard but present in Chromium: the work area's origin (e.g. a top bar or a left dock).
      availLeft: window.screen.availLeft ?? 0,
      availTop: window.screen.availTop ?? 0,
      dpr: window.devicePixelRatio,
    }, insets: { width: window.outerWidth - window.innerWidth, height: window.outerHeight - window.innerHeight } }));
    result = { ok: true, screen, insets, version: browser.version() };
  } finally {
    await browser.close().catch(() => { });
  }
} catch (error) {
  result = { ok: false, error: String(error?.message ?? error).split('\n')[0] };
}
done(result);
