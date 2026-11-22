/**
 * Screenshot gallery of the web app, for design reviews: signs in as the seeded personas of Demo Bank (and the
 * platform staff) and captures every main screen at 1440×900, light and dark.
 *
 *   bun run --cwd apps/e2e screens [--out <dir>] [--only <name,name>] [--dark] [--full]
 *
 * Needs the local stack with the seed (bun run stack). Cases and tasks make the lists worth looking at:
 * `bun run demo:case "Personal loan pre-approval" fullName=… email=… amount=… annualIncome=…`.
 * Output: .data/screens/<timestamp>/<name>.png (or --out).
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { Api, type Session } from '../support/api';
import { env, tenantUrl } from '../support/env';
import { staffSession } from '../support/factories';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const only = option('only')?.split(',');
const dark = args.includes('--dark');
const full = args.includes('--full');
const out = resolve(option('out') ?? join(import.meta.dirname, '../../../.data/screens', new Date().toISOString().replace(/[:.]/g, '-')));
mkdirSync(out, { recursive: true });

const PASSWORD = process.env.SEED_PASSWORD ?? 'lintelia-dev-password';
const BANK = 'demo-bank';

async function member(email: string): Promise<Session> {
  const res = await Api.anonymous(BANK).post<Session & { mfaRequired?: boolean }>('/auth/login', { email, password: PASSWORD });
  if (res.status !== 200 || !res.body.token) throw new Error(`sign-in of ${email} failed: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.body;
}

async function firstId(session: Session, path: string, pick: (rows: any[]) => any = (rows) => rows[0]) {
  const res = await Api.as(session, BANK).get<any[]>(path);
  return res.status === 200 ? pick(res.body)?.id : undefined;
}

/** The client app rendered its page (lazy chunks and data). */
const appReady = async (page: Page) => { await page.getByTestId('app-page').waitFor({ timeout: 30_000 }); await page.waitForTimeout(800); };

interface Shot { name: string; url: string; session?: Session | null; ready?: (page: Page) => Promise<void>; mobile?: boolean }

async function shots(): Promise<Shot[]> {
  const admin = await member('admin@demo-bank.test');
  const analyst = await member('analyst@demo-bank.test');
  const designer = await member('designer@demo-bank.test');
  const client = await member('client@demo-bank.test');
  const rm = await member('rm@demo-bank.test');
  const staff = await staffSession();
  const caseId = await firstId(admin, '/cases', (rows) => rows.find((c) => c.status === 'in_review') ?? rows[0]);
  const clientId = await firstId(admin, '/clients');
  const chrisId = await firstId(admin, '/clients?search=client%40demo-bank.test');
  const taskId = await firstId(analyst, '/tasks?view=mine');
  const workflowId = await firstId(designer, '/workflows');
  const myCaseId = await firstId(client, '/me/cases');
  const bank = (path: string) => tenantUrl(BANK, path);
  const platform = (path: string) => new URL(path, env.webUrl).toString();
  return [
    { name: 'landing', url: platform('/') },
    { name: 'sign-on-platform', url: platform('/sign-on') },
    { name: 'sign-on-bank', url: bank('/sign-on') },
    { name: 'dashboard', url: bank('/app/dashboard'), session: admin },
    { name: 'dashboard-analyst', url: bank('/app/dashboard'), session: analyst },
    { name: 'tasks', url: bank('/app/tasks'), session: analyst },
    { name: 'tasks-queue', url: bank('/app/tasks'), session: analyst, ready: async (p: Page) => { await p.getByRole('tab', { name: 'Team queue' }).click(); } },
    ...(taskId ? [{ name: 'task', url: bank(`/app/tasks/${taskId}`), session: analyst }] : []),
    { name: 'cases', url: bank('/app/cases'), session: admin },
    ...(caseId ? [{ name: 'case', url: bank(`/app/cases/${caseId}`), session: admin }] : []),
    { name: 'clients', url: bank('/app/clients'), session: admin },
    ...(clientId ? [{ name: 'client', url: bank(`/app/clients/${clientId}`), session: admin }] : []),
    ...(chrisId ? [{ name: 'client-app-data', url: bank(`/app/clients/${chrisId}`), session: admin }] : []),
    { name: 'forms', url: bank('/app/forms'), session: designer },
    { name: 'workflows', url: bank('/app/workflows'), session: designer },
    ...(workflowId ? [{ name: 'workflow-editor', url: bank(`/app/workflows/${workflowId}`), session: designer }] : []),
    { name: 'integrations', url: bank('/app/integrations'), session: admin },
    { name: 'team', url: bank('/app/users'), session: admin },
    { name: 'roles', url: bank('/app/roles'), session: admin },
    { name: 'roles-matrix', url: bank('/app/roles'), session: admin, ready: async (p: Page) => { await p.getByRole('tab', { name: 'Matrix' }).click(); } },
    { name: 'roles-custom-permissions', url: bank('/app/roles'), session: admin, ready: async (p: Page) => { await p.getByRole('tab', { name: 'Custom permissions' }).click(); } },
    { name: 'role', url: bank('/app/roles/reviewer'), session: admin },
    { name: 'roles-who', url: bank('/app/roles/who?permission=tasks%3Awork'), session: admin },
    { name: 'access-changes', url: bank('/app/access-changes'), session: admin },
    { name: 'team-access', url: bank('/app/users'), session: admin, ready: async (p: Page) => { await p.getByTestId('member-row').filter({ hasText: 'analyst@' }).getByRole('button', { name: 'Access' }).click(); await p.getByTestId('member-access').waitFor(); } },
    { name: 'settings-security', url: bank('/app/settings?tab=security'), session: admin },
    { name: 'settings-read-audit', url: bank('/app/settings?tab=security'), session: admin, ready: async (p: Page) => { await p.getByTestId('read-audit').scrollIntoViewIfNeeded(); } },
    // The institution's own back office (the "Fee waivers" template Demo Bank publishes), as a relationship manager.
    { name: 'bo-desk', url: bank('/app/x/servicing'), session: rm, ready: async (p: Page) => { await p.getByTestId('back-office-widgets').waitFor(); } },
    { name: 'bo-dashboard', url: bank('/app/dashboard'), session: rm, ready: async (p: Page) => { await p.getByTestId('dashboard-slot').waitFor(); } },
    // The studio's back-office mode, as a designer.
    { name: 'bo-studio', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.getByTestId('bo-canvas').getByTestId('back-office-widgets').or(p.locator('[data-select-id]').first()).first().waitFor(); await p.waitForTimeout(500); } },
    { name: 'bo-studio-client', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.getByTestId('bo-slot').filter({ hasText: 'Client page' }).click(); await p.getByTestId('bo-builtin-page').waitFor(); } },
    { name: 'bo-studio-preview', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.getByTestId('bo-preview-as').selectOption('reviewer'); await p.getByTestId('bo-preview-banner').waitFor(); await p.waitForTimeout(1200); } },
    { name: 'bo-studio-widget', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.locator('[data-select-id]').nth(4).click(); await p.getByTestId('widget-inspector').waitFor(); } },
    { name: 'bo-studio-action', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.getByTestId('bo-tab-actions').click(); await p.getByTestId('action-inspector').waitFor(); } },
    { name: 'bo-studio-menu', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.getByTestId('bo-tab-menu').click(); await p.getByTestId('nav-inspector').waitFor(); await p.getByTestId('studio-inspector').evaluate((e) => e.scrollTo(0, 600)); } },
    { name: 'bo-studio-report', url: bank('/app/back-office'), session: designer, ready: async (p: Page) => { await p.getByTestId('open-access-report').click(); await p.getByTestId('access-report').waitFor(); } },
    ...(chrisId ? [
      { name: 'bo-client-tab', url: bank(`/app/clients/${chrisId}`), session: rm, ready: async (p: Page) => { await p.getByRole('tab', { name: 'Servicing' }).click(); await p.getByTestId('back-office-widgets').waitFor(); } },
    ] : []),
    { name: 'audit', url: bank('/app/audit'), session: admin },
    { name: 'settings', url: bank('/app/settings'), session: admin },
    { name: 'webhooks', url: bank('/app/webhooks'), session: admin },
    { name: 'api-clients', url: bank('/app/keys'), session: admin },
    { name: 'profile', url: bank('/app/me'), session: admin },
    { name: 'portal', url: bank('/portal'), session: client, ready: appReady },
    ...(myCaseId ? [{ name: 'portal-case', url: bank(`/portal/cases/${myCaseId}`), session: client }] : []),
    { name: 'portal-requests', url: bank('/portal/requests'), session: client },
    // Client app (Demo Bank publishes the banking app).
    ...['accounts', 'cards', 'insights', 'products', 'activity', 'profile', 'help'].map((p) => ({ name: `app-${p}`, url: bank(`/portal/p/${p}`), session: client, ready: appReady })),
    { name: 'app-account', url: bank('/portal/p/account?key=cur-1'), session: client, ready: appReady },
    { name: 'app-home-mobile', url: bank('/portal'), session: client, mobile: true, ready: appReady },
    { name: 'app-cards-mobile', url: bank('/portal/p/cards'), session: client, mobile: true, ready: appReady },
    { name: 'studio', url: bank('/app/experience'), session: designer, ready: async (p: Page) => { await p.frameLocator('[data-testid=preview-frame]').getByTestId('app-page').waitFor({ timeout: 30_000 }); } },
    { name: 'portal-privacy', url: bank('/portal/privacy'), session: client },
    { name: 'platform-institutions', url: platform('/app/platform/institutions'), session: staff },
    { name: 'platform-connectors', url: platform('/app/platform/connectors'), session: staff },
    { name: 'platform-staff', url: platform('/app/platform/staff'), session: staff },
  ].filter((s) => !only || only.includes(s.name));
}

const browser = await chromium.launch();
let count = 0;
for (const shot of await shots()) {
  const context = await browser.newContext({
    viewport: shot.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: shot.mobile ? 2 : 1, colorScheme: dark ? 'dark' : 'light',
  });
  if (shot.session) {
    await context.addInitScript((value) => window.localStorage.setItem('lintelia.session', value), JSON.stringify(shot.session));
  }
  if (dark) await context.addInitScript(() => window.localStorage.setItem('theme', 'dark'));
  const page = await context.newPage();
  try {
    // Not "networkidle": pages keep a live stream open (docs/plans/17).
    await page.goto(shot.url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !document.querySelector('[data-testid="page-loader"], .animate-pulse[data-skeleton]'), undefined, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await shot.ready?.(page);
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(out, `${shot.name}${dark ? '-dark' : ''}.png`), fullPage: full });
    count++;
  } catch (error) {
    console.warn(`${shot.name}: ${(error as Error).message.split('\n')[0]}`);
  }
  await context.close();
}
await browser.close();
console.log(`${count} screenshots in ${out}`);
