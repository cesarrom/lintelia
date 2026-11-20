import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { FakeWebsite } from '../../support/website';
import { bankingCustomer, installBankingApp, systemApi } from '../../support/client-app';

/**
 * APP-09 The bank shows the app inside its own online banking (another site) with @lintelia/client-sdk: the site's
 * backend opens a client session for its signed-in customer, the SDK hands the single-use secret to the app; the site
 * drives navigation and hears about journeys. Sites the bank did not allow cannot frame the app.
 */
test.describe.configure({ timeout: 150_000 });

let inst: Institution;
let system: Api;
const website = new FakeWebsite('online.bank-site.localhost');
const copycat = new FakeWebsite('phishing-site.localhost');

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  await website.start();
  await copycat.start();
  const designer = Api.as(inst.members.designer);
  const installed = await installBankingApp(designer);
  const draft = { ...installed.definition, embed: { allowedOrigins: [website.origin] } };
  expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
  expectStatus(await designer.post('/client-apps/current/publish'), 200);
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => {
  await website.stop();
  await copycat.stop();
  await deleteTenant(inst?.bank);
});

/** The bank's online-banking page: the SDK from the institution's host, the app mounted with a session from "its backend". */
function bankingPage(site: FakeWebsite, secrets: string[], options = '') {
  const appUrl = inst.bank.url('').replace(/\/$/, '');
  site.page('Online banking', `
    <div id="banking" style="max-width:1200px"></div>
    <pre id="events"></pre>
    <script src="${appUrl}/lintelia-client.js"></script>
    <script>
      const secrets = ${JSON.stringify(secrets)};
      window.sdkEvents = [];
      window.app = LinteliaClient.mount('#banking', {
        appUrl: ${JSON.stringify(appUrl)}, title: 'Online banking', height: 760, ${options}
        // The site's backend would call POST /client-sessions here; the test did it beforehand.
        fetchClientSecret: async () => secrets.shift(),
        onReady: (page) => window.sdkEvents.push('ready:' + page),
        onEvent: (event) => { window.sdkEvents.push(event.name + ':' + (event.detail.journey || event.detail.page || '')); document.getElementById('events').textContent = window.sdkEvents.join('\\n'); },
      });
    </script>`);
}

async function secretFor(customer: { externalId: string; email: string }) {
  const created = await system.post('/client-sessions', { externalId: customer.externalId, email: customer.email, name: 'Emma Embedded' });
  expectStatus(created, 201);
  return created.body.clientSecret as string;
}

test.describe('APP-09 Embed the app in the bank\'s own site', { tag: ['@client', '@APP-09', '@APP-07'] }, () => {
  test('the site mounts the app with a client session, navigates it and hears about journeys', async ({ page }) => {
    const customer = await bankingCustomer(inst.bank, system, { name: 'Emma Embedded', current: 800 });
    bankingPage(website, [await secretFor(customer)]);
    await page.goto(`${website.origin}/online-banking`);
    const app = page.frameLocator('iframe[title="Online banking"]');
    await expect(app.getByTestId('client-app')).toBeVisible({ timeout: 30_000 });
    await expect(app.getByTestId('hero-value')).toHaveText('£1,300.00');
    await expect(app.getByTestId('app-user')).toHaveText('Emma Embedded');
    await expect.poll(() => page.evaluate(() => (window as any).sdkEvents)).toContain('ready:home');

    // The site opens a page of the app, then starts a one-tap journey.
    await page.evaluate(() => (window as any).app.navigate('cards'));
    await expect(app.getByTestId('app-page-title')).toHaveText('Cards');
    await page.evaluate(() => (window as any).app.startJourney('card_freeze', { card: 'card-1' }));
    await expect(app.getByTestId('payment-card')).toHaveAttribute('data-status', 'frozen', { timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => (window as any).sdkEvents)).toEqual(expect.arrayContaining(['journey.started:card_freeze', 'journey.completed:card_freeze']));
    // The embedded session never mixes with a session of the full site (own storage, tab only).
    const stored = await page.frames().find((f) => f.url().includes('/embed/app'))!.evaluate(() => ({ local: localStorage.getItem('lintelia.session'), tab: !!sessionStorage.getItem('lintelia.embedded-session') }));
    expect(stored).toEqual({ local: null, tab: true });
  });

  test('content-only mode: no app menu, the frame grows with its content', async ({ page }) => {
    const customer = await bankingCustomer(inst.bank, system, { name: 'Emma Embedded' });
    bankingPage(website, [await secretFor(customer)], "chrome: 'none', page: 'accounts',");
    await page.goto(`${website.origin}/online-banking`);
    const app = page.frameLocator('iframe[title="Online banking"]');
    await expect(app.getByTestId('app-page-title')).toHaveText('Accounts', { timeout: 30_000 });
    await expect(app.getByTestId('app-nav')).toHaveCount(0);
    await expect.poll(async () => Number.parseInt(await page.locator('iframe[title="Online banking"]').evaluate((f) => (f as HTMLIFrameElement).style.height), 10)).toBeGreaterThan(600);
  });

  test('a used secret does not sign in, and a site the bank did not allow cannot show the app', async ({ page, browser }) => {
    const customer = await bankingCustomer(inst.bank, system, { name: 'Emma Embedded' });
    const secret = await secretFor(customer);
    expectStatus(await Api.anonymous(inst.bank.key).post('/auth/client/session', { clientSecret: secret }), 200);
    bankingPage(website, [secret]);
    await page.goto(`${website.origin}/online-banking`);
    const app = page.frameLocator('iframe[title="Online banking"]');
    await expect(app.getByTestId('embed-notice')).toContainText('We could not sign you in', { timeout: 30_000 });

    const context = await browser.newContext();
    const phishing = await context.newPage();
    bankingPage(copycat, [await secretFor(customer)]);
    await phishing.goto(`${copycat.origin}/online-banking`);
    await expect(phishing.locator('iframe[title="Online banking"]')).toHaveCount(1);
    await phishing.waitForTimeout(2500);
    // The browser refuses to render the app inside that site (frame-ancestors), so nothing of it shows.
    const framed = phishing.frames().find((f) => f.url().includes('/embed/app'));
    expect(await framed?.getByTestId('client-app').count().catch(() => 0) ?? 0).toBe(0);
    await context.close();
  });
});
