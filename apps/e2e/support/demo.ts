import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Browser, type Locator, type Page } from '@playwright/test';
import type { Session } from './api';
import { Api } from './api';
import { env, tenantUrl } from './env';
import { addMember, uniqueEmail, uniqueKey, staffSession, acceptInvitation, type TenantHandle } from './factories';
import { expectStatus } from './api';
import { useSession } from './ui';

/**
 * Demo recording (`E2E_DEMO=1`, project "demo"): the stories in tests/demo are recorded as sales material.
 * Each story opens its windows with `recordedContext`, marks what is happening with `scene(...)` and writes
 * `demo-timeline.json` next to the videos, so demo/compose.py can line the narration up with the footage.
 * Nothing here runs in a normal run: the demo project only exists when E2E_DEMO=1.
 */
export const demo = process.env.E2E_DEMO === '1';

type Rec = {
  t0: number;
  stepNo: number;
  windows: { label: string; startMs: number; video: string | null }[];
  events: { at: number; kind: 'step' | 'step-end' | 'focus' | 'unfocus'; no: number; title: string; actor: string; rect?: { x: number; y: number; w: number; h: number } }[];
  open: (() => void) | null;
};
const records = new Map<string, Rec>();

function current() {
  const info = test.info();
  let rec = records.get(info.testId);
  if (!rec) records.set(info.testId, (rec = { t0: Date.now(), stepNo: 0, windows: [], events: [], open: null }));
  return { info, rec };
}

function flush(info: ReturnType<typeof test.info>, rec: Rec): void {
  const events = rec.events.map((e) => ({ ...e, at: e.at - rec.t0 }));
  const windows = rec.windows.map((w) => ({ ...w, startMs: w.startMs - rec.t0 }));
  writeFileSync(info.outputPath('demo-timeline.json'), JSON.stringify({ test: info.titlePath.slice(1).join(' › '), windows, events }, null, 2));
}

/**
 * A browser window for one person in the story: 1440x900 for the web app, a phone (390x844, touch) for the client
 * app seen on a phone. English, signed in when `session` is given (the web app keeps the session in localStorage).
 * `warm` is a path opened first (and awaited) so the footage never opens on a loading screen.
 */
export async function recordedContext(browser: Browser, label: string, opts: { app: 'web' | 'phone'; session?: Session; url: string; ready?: (page: Page) => Promise<unknown> }) {
  const { info, rec } = current();
  const phone = opts.app === 'phone';
  const size = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({
    viewport: size,
    ...(phone ? { isMobile: true, hasTouch: true } : {}),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'light',
    recordVideo: { dir: info.outputPath('demo-video'), size },
  });
  const page = await context.newPage();
  const entry = { label, startMs: Date.now(), video: null as string | null };
  rec.windows.push(entry);
  flush(info, rec);
  if (opts.session) await useSession(page, opts.session);
  await page.goto(opts.url);
  if (opts.ready) await opts.ready(page);
  return {
    context,
    page,
    close: async () => {
      const video = page.video();
      await context.close();
      entry.video = video ? await video.path() : null;
      flush(info, rec);
    },
  };
}

/** What is happening now. Ends the previous scene. `actor` is the chip label ("" for the first window). */
export function scene(title: string, actor = ''): void {
  const { info, rec } = current();
  if (rec.open) rec.open();
  const no = (rec.stepNo += 1);
  rec.events.push({ at: Date.now(), kind: 'step', no, title, actor });
  rec.open = () => rec.events.push({ at: Date.now(), kind: 'step-end', no, title, actor });
  flush(info, rec);
}

/** Close the last scene (call before closing the windows). */
export function endScenes(): void {
  const { info, rec } = current();
  if (rec.open) rec.open();
  rec.open = null;
  flush(info, rec);
}

/** Type like a person, so a viewer can follow what is being entered. */
export async function typeSlow(target: Locator, text: string, delay = 70): Promise<void> {
  await target.click();
  await target.fill('');
  await target.pressSequentially(text, { delay });
}

/** A beat for the viewer to take in what is on screen. The composer re-times footage to the narration. */
const PACE = Number(process.env.E2E_DEMO_PACE ?? 1.5);
export const beat = (page: Page, ms = 1200) => page.waitForTimeout(Math.round(ms * PACE));

/**
 * Draw the viewer's eye to what matters right now: dim the rest of the page with a spotlight around `target`, and
 * record where it is (as fractions of the window) so demo/compose.py zooms on exactly that region for the current
 * scene. `unfocus` removes it. Presentation only.
 */
export async function focus(page: Page, target: Locator, { pad = 14, dim = 0.45 }: { pad?: number; dim?: number } = {}): Promise<void> {
  if (!demo) return;
  await target.first().scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(700);
  const box = await target.first().boundingBox();
  const vp = page.viewportSize();
  if (!box || !vp) return;
  await page.evaluate(
    ({ x, y, w, h, pad, dim }) => {
      document.getElementById('__demo_focus')?.remove();
      const el = document.createElement('div');
      el.id = '__demo_focus';
      el.style.cssText =
        `position:fixed;left:${x - pad}px;top:${y - pad}px;width:${w + 2 * pad}px;height:${h + 2 * pad}px;border-radius:12px;` +
        `box-shadow:0 0 0 9999px rgba(8,20,38,${dim});outline:2px solid rgba(46,170,160,.95);pointer-events:none;z-index:2147483647;opacity:0;transition:opacity .4s`;
      document.body.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = '1'));
    },
    { x: box.x, y: box.y, w: box.width, h: box.height, pad, dim },
  );
  const { info, rec } = current();
  rec.events.push({ at: Date.now(), kind: 'focus', no: rec.stepNo, title: '', actor: '', rect: { x: box.x / vp.width, y: box.y / vp.height, w: box.width / vp.width, h: box.height / vp.height } });
  flush(info, rec);
}

export async function unfocus(page: Page): Promise<void> {
  if (!demo) return;
  const { info, rec } = current();
  rec.events.push({ at: Date.now(), kind: 'unfocus', no: rec.stepNo, title: '', actor: '' });
  flush(info, rec);
  await page.evaluate(() => {
    const el = document.getElementById('__demo_focus');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 450);
    }
  });
}

/** A still of the current screen for demo/screens (set DEMO_SCREENS_DIR; no-op otherwise). */
export async function still(page: Page, name: string): Promise<void> {
  const dir = process.env.DEMO_SCREENS_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.evaluate(() => document.getElementById('__demo_focus')?.style.setProperty('display', 'none'));
  await page.screenshot({ path: join(dir, `${name}.png`) });
  await page.evaluate(() => document.getElementById('__demo_focus')?.style.removeProperty('display'));
}

/** Plain-named demo institution: staff onboard it (like STAFF-02) and its administrator activates the account. */
export async function demoTenant(name: string, keyBase: string, adminName = 'Olivia Owner'): Promise<TenantHandle> {
  const staff = Api.as(await staffSession());
  const key = `${keyBase}-${uniqueKey('d').slice(-5)}`;
  const adminEmail = `olivia.owner@${key}.example`;
  const since = Date.now() - 1000;
  const created = await staff.post('/tenants', { name, domain: key, invitee: [{ email: adminEmail, role: 'admin' }] });
  expectStatus(created, 201);
  const admin = await acceptInvitation({ tenant: key, email: adminEmail, since, name: adminName });
  return { key, host: new URL(tenantUrl(key)).host, url: (p = '/') => tenantUrl(key, p), tenant: created.body, admin, adminEmail, adminApi: Api.as(admin) };
}

/** A team member with a plain name ("Amara Analyst"), invited and activated. */
export async function demoMember(bank: TenantHandle, fullName: string, role: string) {
  const slug = fullName.toLowerCase().replace(/[^a-z]+/g, '.');
  const email = `${slug}@${bank.key}.example`;
  const since = Date.now() - 1000;
  expectStatus(await bank.adminApi.post('/users', { email, name: fullName, roleIds: [role] }), [200, 201]);
  const session = await acceptInvitation({ tenant: bank.key, email, since, name: fullName });
  return { ...session, email };
}

export { addMember, uniqueEmail, env };

/** Remove leftover test institutions so the console list shows only the three seeded ones (demo footage). */
export async function purgeLeftoverTenants(keep: string[] = []) {
  const staff = Api.as(await staffSession());
  const list = await staff.get('/tenants');
  if (list.status !== 200) return;
  const seeded = new Set(['acme-credit', 'demo-auto', 'demo-bank', ...keep]);
  for (const t of list.body as Array<{ domain: string }>) {
    if (seeded.has(t.domain)) continue;
    await staff.put(`/tenants/${t.domain}`, { data: { status: 'suspended' } });
    await staff.delete(`/tenants/${t.domain}`);
  }
}
