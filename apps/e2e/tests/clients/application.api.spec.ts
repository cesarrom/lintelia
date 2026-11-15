import { test, expect } from '@playwright/test';
import { Api, expectStatus, type Session } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { otpCode, waitForEmail } from '../../support/mailbox';
import { applyAsClient, decide, prepareInstitution, publishForm, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  const designer = Api.as(inst.members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const origin = () => inst.bank.url('').replace(/\/$/, '');

test.describe("CLI-03 Apply from the institution's website, save and resume", { tag: ['@client', '@CLI-03'] }, () => {
  test('a submission stays a draft until the applicant confirms their e-mail', async () => {
    const email = uniqueEmail('draft', 'customers.example');
    const submitted = await Api.anonymous(inst.bank.key).withHeaders({ Origin: origin() })
      .post(`/public/forms/${publicKey}/submissions`, { email, answers: { fullName: 'Dora Draft', email } });
    expectStatus(submitted, 202);
    expect(submitted.body.status).toBe('draft');
    const kase = await inst.bank.adminApi.get(`/cases/${submitted.body.caseId}`);
    expect(kase.body.status).toBe('draft');
  });

  test('the applicant resumes on another device with a code and finds the application', async () => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey);
    const since = Date.now() - 1000;
    expectStatus(await Api.anonymous(inst.bank.key).post('/auth/otp/start', { email: client.email }), 202);
    const code = otpCode(await waitForEmail({ tenant: inst.bank.key, to: client.email, since }));
    const otherDevice = await Api.anonymous(inst.bank.key).post<Session>('/auth/otp/verify', { email: client.email, code });
    expectStatus(otherDevice, 200);
    const mine = await Api.as(otherDevice.body).get('/me/cases');
    expectStatus(mine, 200);
    expect((mine.body as any[]).map((c) => c.id)).toContain(caseId);
  });

  test('public submissions are rate limited', async () => {
    // A form of its own: the limit applies per form and client address.
    const designer = Api.as(inst.members.designer);
    const workflowId = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
    const { publicKey: floodedKey } = await publishForm(designer, inst.bank, workflowId);
    const attempts = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      Api.anonymous(inst.bank.key).withHeaders({ Origin: origin() })
        .post(`/public/forms/${floodedKey}/submissions`, { email: `flood${i}@customers.example`, answers: {} })));
    expect(attempts.some((r) => r.status === 429)).toBe(true);
  });
});

test.describe('CLI-07 Track my application and get notified', { tag: ['@client', '@CLI-07'] }, () => {
  test('the applicant sees progress and is e-mailed the decision', async () => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey);
    const me = Api.as(client);
    await expect.poll(async () => (await me.get(`/me/cases/${caseId}`)).body?.status, { timeout: 20_000 }).toBe('in_review');
    const pending = await me.get(`/me/cases/${caseId}`);
    expectStatus(pending, 200);
    expect(pending.body.steps.map((s: any) => s.name)).toEqual(expect.arrayContaining(['Onboarding review']));
    expect(JSON.stringify(pending.body)).not.toContain(inst.members.analyst.email);

    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, caseId);
    await analyst.post(`/tasks/${task.id}/claim`);
    const since = Date.now() - 1000;
    expectStatus(await decide(analyst, task.id, 'approve'), 200);
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved');

    expect((await me.get(`/me/cases/${caseId}`)).body.status).toBe('approved');
    await waitForEmail({ tenant: inst.bank.key, to: client.email, subject: /approved/i, since });
  });
});
