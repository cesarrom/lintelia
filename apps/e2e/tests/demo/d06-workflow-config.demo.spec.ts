import { test, expect } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { FakeWebsite } from '../../support/website';
import { prepareInstitution } from '../../support/scenario';
import { beat, endScenes, focus, recordedContext, scene, still, typeSlow, unfocus, demoMember } from '../../support/demo';
import { FORM_NAME } from '../../support/demo-loan';
import { embeddedForm } from '../../support/ui';

/** D06: the flow designer builds the application form, creates the workflow from a template, publishes both and embeds the form. */
test.describe.configure({ timeout: 400_000 });
const website = new FakeWebsite('www.northwind-bank.localhost');

test('d06 a designer builds a form and a workflow and embeds the form on the bank site', async ({ browser }) => {
  await website.start();
  const inst = await prepareInstitution({ name: 'Northwind Bank' });
  try {
    const designer = await demoMember(inst.bank, 'Dana Designer', 'flow_designer');
    const rec = await recordedContext(browser, 'designer', { app: 'web', session: designer, url: inst.bank.url('/app/forms'),
      ready: async (p) => { await expect(p.getByRole('button', { name: 'Create Form' })).toBeVisible({ timeout: 20_000 }); } });
    const dp = rec.page;
    await beat(dp, 1500);
    scene('Create a form', 'designer');
    await dp.getByRole('button', { name: 'Create Form' }).click();
    const dialog = dp.getByRole('dialog');
    await typeSlow(dialog.getByLabel('Form name'), FORM_NAME);
    await typeSlow(dialog.getByLabel('Description'), 'Tell us about the loan you need.');
    scene('Add the fields the bank needs', 'designer');
    const fields: Array<[string, string, string]> = [
      ['Add Text Field', 'fullName', 'Full name'], ['Add Email', 'email', 'E-mail'],
      ['Add Number Field', 'amount', 'Loan amount'], ['Add Number Field', 'annualIncome', 'Annual income'],
    ];
    const properties = dialog.getByRole('region', { name: 'Properties' });
    for (const [component, property, label] of fields) {
      await dialog.getByTitle(component).click();
      await properties.getByPlaceholder('Enter property name').fill(property);
      await properties.getByPlaceholder('Enter label').fill(label);
      await beat(dp, 900);
    }
    await focus(dp, dialog.getByRole('region', { name: 'Form canvas' }));
    await beat(dp, 3500);
    await still(dp, 'designer-form-builder');
    await unfocus(dp);
    await dialog.getByRole('button', { name: 'Create Form' }).click();
    await expect(dp.getByTestId('form-row').filter({ hasText: FORM_NAME })).toBeVisible();

    scene('Start the workflow from a template', 'designer');
    await dp.goto(inst.bank.url('/app/workflows'));
    await dp.getByRole('button', { name: 'New from template' }).click();
    const tpl = dp.getByTestId('workflow-template').filter({ hasText: 'Personal loan pre-approval' });
    await expect(tpl).toBeVisible();
    await focus(dp, tpl);
    await beat(dp, 4000);
    await still(dp, 'designer-templates');
    await unfocus(dp);
    await tpl.getByRole('button', { name: 'Use template' }).click();

    scene('Publish the workflow', 'designer');
    const wrow = dp.getByTestId('workflow-row').filter({ hasText: 'Personal loan pre-approval' });
    await expect(wrow.getByTestId('workflow-version')).toHaveText('Draft');
    await beat(dp, 2000);
    await wrow.getByRole('button', { name: /Actions for/ }).click();
    await dp.getByRole('menuitem', { name: 'Publish' }).click();
    await expect(wrow.getByTestId('workflow-version')).toHaveText('v1');
    await focus(dp, wrow);
    await beat(dp, 3500);
    await unfocus(dp);

    scene('Publish the form and allow the bank website to embed it', 'designer');
    await dp.goto(inst.bank.url('/app/forms'));
    const row = dp.getByTestId('form-row').filter({ hasText: FORM_NAME });
    await row.getByRole('button', { name: `Actions for ${FORM_NAME}` }).click();
    await dp.getByRole('menuitem', { name: 'Publish & embed' }).click();
    const pd = dp.getByRole('dialog');
    await pd.getByRole('combobox', { name: 'Workflow' }).click();
    await dp.getByRole('option', { name: /Personal loan pre-approval \(v1\)/ }).click();
    await beat(dp, 1500);
    await typeSlow(pd.getByLabel(/Websites allowed to embed it/), website.origin);
    await beat(dp, 1500);
    await pd.getByRole('button', { name: 'Publish' }).click();
    await expect(pd.getByTestId('embed-script')).toContainText('data-lintelia-form=');

    scene('Copy one snippet onto the website', 'designer');
    await focus(dp, pd.getByTestId('embed-script'));
    await beat(dp, 4500);
    await still(dp, 'designer-embed-snippet');
    await unfocus(dp);
    const snippet = (await pd.getByTestId('embed-script').textContent())!;
    expect(snippet).toContain('data-lintelia-form=');
    website.page('Personal loans', snippet);
    const site = await recordedContext(browser, 'site', { app: 'web', url: `${website.origin}/apply`, ready: async (p) => { await embeddedForm(p, FORM_NAME); } });
    scene('Live on the website', 'site');
    await beat(site.page, 1500);
    await focus(site.page, site.page.locator(`iframe[title="${FORM_NAME}"]`));
    await beat(site.page, 6000);
    await still(site.page, 'site-live-form');
    await unfocus(site.page);
    endScenes();
    await rec.close(); await site.close();
  } finally {
    await website.stop();
    await deleteTenant(inst.bank);
  }
});
