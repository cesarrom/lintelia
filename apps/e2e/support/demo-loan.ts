import type { Browser, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { prepareInstitution, type Institution } from './scenario';
import { FakeWebsite } from './website';
import { claimFromQueue, confirmApplication, embeddedForm, openInstitutionWebsite, personaPage } from './ui';
import { demoMember } from './demo';

export const FORM_NAME = 'Personal loan pre-approval';

/** The loan pre-approval institution of SCN-10 (form builder, template workflow, publish and embed), built unrecorded. */
export async function loanInstitution(browser: Browser, website: FakeWebsite, name: string) {
  const inst: Institution = await prepareInstitution({ name });
  const members = {
    designer: await demoMember(inst.bank, 'Dana Designer', 'flow_designer'),
    analyst: await demoMember(inst.bank, 'Amara Analyst', 'reviewer'),
    lead: await demoMember(inst.bank, 'Luis Lead', 'senior_reviewer'),
    lead2: await demoMember(inst.bank, 'Sofia Senior', 'senior_reviewer'),
  };
  const designer = await personaPage(browser, inst.bank.key, members.designer, '/app/forms');
  await designer.getByRole('button', { name: 'Create Form' }).click();
  const dialog = designer.getByRole('dialog');
  await dialog.getByLabel('Form name').fill(FORM_NAME);
  await dialog.getByLabel('Description').fill('Tell us about the loan you need.');
  const fields: Array<[string, string, string]> = [
    ['Add Text Field', 'fullName', 'Full name'], ['Add Email', 'email', 'E-mail'],
    ['Add Number Field', 'amount', 'Loan amount'], ['Add Number Field', 'annualIncome', 'Annual income'],
  ];
  const properties = dialog.getByRole('region', { name: 'Properties' });
  for (const [component, property, label] of fields) {
    await dialog.getByTitle(component).click();
    await properties.getByPlaceholder('Enter property name').fill(property);
    await properties.getByPlaceholder('Enter label').fill(label);
  }
  await dialog.getByRole('button', { name: 'Create Form' }).click();
  await expect(designer.getByTestId('form-row').filter({ hasText: FORM_NAME })).toBeVisible();
  await designer.goto(inst.bank.url('/app/workflows'));
  await designer.getByRole('button', { name: 'New from template' }).click();
  await designer.getByTestId('workflow-template').filter({ hasText: 'Personal loan pre-approval' }).getByRole('button', { name: 'Use template' }).click();
  const wrow = designer.getByTestId('workflow-row').filter({ hasText: 'Personal loan pre-approval' });
  await wrow.getByRole('button', { name: /Actions for/ }).click();
  await designer.getByRole('menuitem', { name: 'Publish' }).click();
  await expect(wrow.getByTestId('workflow-version')).toHaveText('v1');
  await designer.goto(inst.bank.url('/app/forms'));
  const row = designer.getByTestId('form-row').filter({ hasText: FORM_NAME });
  await row.getByRole('button', { name: `Actions for ${FORM_NAME}` }).click();
  await designer.getByRole('menuitem', { name: 'Publish & embed' }).click();
  const pd = designer.getByRole('dialog');
  await pd.getByRole('combobox', { name: 'Workflow' }).click();
  await designer.getByRole('option', { name: /Personal loan pre-approval \(v1\)/ }).click();
  await pd.getByLabel(/Websites allowed to embed it/).fill(website.origin);
  await pd.getByRole('button', { name: 'Publish' }).click();
  await expect(pd.getByTestId('embed-script')).toContainText('data-lintelia-form=');
  const snippet = (await pd.getByTestId('embed-script').textContent())!;
  await designer.context().close();
  return { inst, members, snippet };
}

/** An applicant applies on the bank's website and confirms the e-mail code; returns the case reference. */
export async function applyOnSite(page: Page, inst: Institution, website: FakeWebsite, snippet: string, a: { name: string; email: string; amount: number; income: number }, slow?: (p: Page) => Promise<void>) {
  await openInstitutionWebsite(page, website, snippet);
  const form = await embeddedForm(page, FORM_NAME);
  if (slow) await slow(page);
  await form.getByLabel('Full name').pressSequentially(a.name, { delay: 45 });
  await form.getByLabel('E-mail').fill(a.email);
  await form.getByLabel('Loan amount').fill(String(a.amount));
  await form.getByLabel('Annual income').fill(String(a.income));
  const since = Date.now() - 1000;
  await form.getByRole('button', { name: 'Submit' }).click();
  return confirmApplication(form, inst.bank.key, a.email, since);
}
export { claimFromQueue };
