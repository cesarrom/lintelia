import { expect, type Browser, type FrameLocator, type Page } from '@playwright/test';
import type { Session } from './api';
import { env, tenantUrl } from './env';
import { otpCode, waitForEmail } from './mailbox';
import { rememberTotpSecret, staffSession, totpSecretOf } from './factories';
import { totp } from './totp';
import type { FakeWebsite } from './website';

/**
 * Start a browser page already signed in (the web app keeps the session in localStorage under `lintelia.session`).
 * Use the sign-in form only in tests that are about signing in.
 */
export async function useSession(page: Page, session: Session) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('lintelia.session', value);
  }, JSON.stringify(session));
}

export const platformUrl = (path = '/') => new URL(path, env.webUrl).toString();

/** The platform console as the seeded staff member, already signed in (tests that are not about signing in). */
export async function openPlatformAsStaff(page: Page, path = '/app/platform/institutions') {
  await useSession(page, await staffSession());
  await page.goto(platformUrl(path));
}

export async function openAsTenantUser(page: Page, tenantKey: string, session: Session, path = '/app/dashboard') {
  await useSession(page, session);
  await page.goto(tenantUrl(tenantKey, path));
}

export async function signInThroughForm(page: Page, url: string, email: string, password: string) {
  await page.goto(url);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await completeSecondFactor(page, email);
}

/**
 * After a password step in the browser: enrol (remembering the secret) or type the authenticator code, like a person
 * with an authenticator app. Nothing to do when the account needs no second factor.
 */
export async function completeSecondFactor(page: Page, email: string) {
  const code = page.getByLabel('Authentication code');
  const needed = await Promise.race([
    code.waitFor({ timeout: 15_000 }).then(() => true),
    page.waitForURL((u) => !u.pathname.includes('sign-on'), { timeout: 15_000 }).then(() => false),
  ]).catch(() => false);
  if (!needed) return;
  const secretBox = page.getByTestId('totp-secret');
  if (await secretBox.isVisible()) {
    const secret = (await secretBox.textContent())!.trim();
    rememberTotpSecret(email, secret);
    await code.fill(totp(secret));
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('button', { name: 'I saved them, continue' }).click();
    return;
  }
  const secret = totpSecretOf(email);
  if (!secret) throw new Error(`No TOTP secret known for ${email}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    await code.fill(totp(secret));
    await page.getByRole('button', { name: 'Verify' }).click();
    const refused = await page.getByTestId('sign-on-error').waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
    if (!refused) return;
    // The code of this 30-second window was used by another sign-in of the same account: wait for the next one.
    await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 300);
  }
}

/** A separate browser context (own storage) for one persona, signed in and on `path` of the institution's host. */
export async function personaPage(browser: Browser, tenantKey: string, session: Session, path = '/app/dashboard') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openAsTenantUser(page, tenantKey, session, path);
  return page;
}

/** Open the institution's public website (a FakeWebsite) after pasting `snippet` into it. */
export async function openInstitutionWebsite(page: Page, site: FakeWebsite, snippet: string, title = 'Personal loans') {
  site.page(title, snippet);
  await page.goto(`${site.origin}/apply`);
}

/** The form embedded on the page (waits for the hosted form to render inside its iframe). */
export async function embeddedForm(page: Page, title: string) {
  const form = page.frameLocator(`iframe[title="${title}"]`);
  await expect(form.getByTestId('embed-form-title')).toHaveText(title, { timeout: 30_000 });
  return form;
}

/** Confirm an application in the embedded form with the code e-mailed to the applicant; returns the case reference. */
export async function confirmApplication(form: FrameLocator, tenantKey: string, email: string, since: number) {
  await expect(form.getByLabel('Verification code')).toBeVisible();
  const code = otpCode(await waitForEmail({ tenant: tenantKey, to: email, since, subject: /code/i }));
  await form.getByLabel('Verification code').fill(code);
  await form.getByRole('button', { name: 'Confirm' }).click();
  await expect(form.getByTestId('embed-confirmation')).toBeVisible();
  return (await form.getByTestId('application-reference').textContent())!.trim();
}

/** Client portal sign-in with an e-mailed one-time code (no password). */
export async function signInWithCode(page: Page, tenantKey: string, email: string) {
  await page.goto(tenantUrl(tenantKey, '/sign-on'));
  await page.getByLabel('Email').fill(email);
  const since = Date.now() - 1000;
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = otpCode(await waitForEmail({ tenant: tenantKey, to: email, since, subject: /code/i }));
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/portal/);
}

/** Open a task from the team queue by its case reference and claim it; ends on the task page. */
export async function claimFromQueue(page: Page, reference: string) {
  await page.getByRole('tab', { name: 'Team queue' }).click();
  const row = page.getByTestId('task-row').filter({ hasText: reference });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole('button', { name: 'Claim' }).click();
  await expect(page).toHaveURL(/\/app\/tasks\/[0-9a-f-]+$/);
}

/** Choose an outcome on the task page, give the reason and confirm. */
export async function decideTask(page: Page, outcome: string | RegExp, reason?: string) {
  await page.getByRole('button', { name: outcome }).click();
  if (reason) await page.getByLabel(/Reason|What do you need/).fill(reason);
  await page.getByRole('button', { name: 'Confirm decision' }).click();
}
