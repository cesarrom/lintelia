import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { prepareInstitution, waitForCase, type Institution } from '../../support/scenario';
import { confirmApplication, embeddedForm, openInstitutionWebsite } from '../../support/ui';
import { FakeWebsite } from '../../support/website';
import { publishWorkflow, simpleFormConfig, workflowFixture } from '../../support/workflows';

let inst: Institution;
let embedScript: string;
const website = new FakeWebsite('www.open-account.localhost');

test.beforeAll(async () => {
  await website.start();
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  const designer = Api.as(inst.members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  const form = await designer.post('/forms', { name: 'Open an account', config: simpleFormConfig('open-account') });
  const published = await designer.post(`/forms/${form.body.id}/publish`, { workflowId, allowedOrigins: [website.origin] });
  expectStatus(published, 200);
  embedScript = published.body.embed.script;
});
test.afterAll(async () => {
  await website.stop();
  await deleteTenant(inst?.bank);
});

test.describe("CLI-03 Apply from a form embedded on the institution's website", { tag: ['@client', '@CLI-03', '@DES-01'] }, () => {
  test('the applicant fills the embedded form, confirms their e-mail and the application is submitted', async ({ page }) => {
    await openInstitutionWebsite(page, website, embedScript, 'Open an account');
    const form = await embeddedForm(page, 'Open an account');
    const email = uniqueEmail('embedded', 'customers.example');
    await form.getByLabel('Full name').fill('Emma Embedded');
    await form.getByLabel('E-mail').fill(email);
    const since = Date.now() - 1000;
    await form.getByRole('button', { name: 'Submit' }).click();
    const reference = await confirmApplication(form, inst.bank.key, email, since);
    expect(reference).toMatch(/^C-\d{4}-[A-Z0-9]{6}$/);

    const cases = await inst.bank.adminApi.get(`/cases?search=${encodeURIComponent(reference)}`);
    const kase = await waitForCase(inst.bank.adminApi, cases.body[0].id, (c) => c.status === 'in_review');
    expect(kase.applicant).toMatchObject({ email, name: 'Emma Embedded' });
    expect(kase.source).toMatch(/^form:/);
  });

  test('an application is not submitted until the e-mail is confirmed', async ({ page }) => {
    await openInstitutionWebsite(page, website, embedScript, 'Open an account');
    const form = await embeddedForm(page, 'Open an account');
    const email = uniqueEmail('unconfirmed', 'customers.example');
    await form.getByLabel('Full name').fill('Una Confirmed');
    await form.getByLabel('E-mail').fill(email);
    await form.getByRole('button', { name: 'Submit' }).click();
    await form.getByLabel('Verification code').fill('000000');
    await form.getByRole('button', { name: 'Confirm' }).click();
    await expect(form.getByTestId('embed-submit-error')).toBeVisible();
    const cases = await inst.bank.adminApi.get(`/cases?search=${encodeURIComponent(email)}`);
    expect((cases.body as any[]).filter((c) => c.status !== 'draft')).toHaveLength(0);
  });
});
