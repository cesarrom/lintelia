import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { rm1: 'relationship_manager', rm2: 'relationship_manager', designer: 'flow_designer' } });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('RM-01 Start an assisted application for a client', { tag: ['@relationship-manager', '@RM-01'] }, () => {
  test('the client is invited to review, consent and continue what the RM started', async () => {
    const email = uniqueEmail('walk-in', 'customers.example');
    const since = Date.now() - 1000;
    const created = await Api.as(inst.members.rm1).post('/cases', { workflowId, client: { email, name: 'Walk In' }, inputs: { email } });
    expectStatus(created, 201);
    expect(created.body).toMatchObject({ status: 'pending_client', initiatedBy: { email: inst.members.rm1.email } });

    const mail = await waitForEmail({ tenant: inst.bank.key, to: email, since });
    expect(linkWithParam(mail, 'case').value).toBe(created.body.id);
  });
});

test.describe('RM-02 Follow only my clients', { tag: ['@relationship-manager', '@RM-02'] }, () => {
  test("relationship managers see their clients' cases and not their colleagues'", async () => {
    const email = uniqueEmail('rm-client', 'customers.example');
    const created = await Api.as(inst.members.rm1).post('/cases', { workflowId, client: { email, name: 'Mine' }, inputs: { email } });
    expectStatus(created, 201);
    const mine = await Api.as(inst.members.rm1).get('/cases');
    expect((mine.body as any[]).map((c) => c.id)).toContain(created.body.id);
    const theirs = await Api.as(inst.members.rm2).get('/cases');
    expectStatus(theirs, 200);
    expect((theirs.body as any[]).map((c) => c.id)).not.toContain(created.body.id);
    expectStatus(await Api.as(inst.members.rm2).get(`/cases/${created.body.id}`), 404);
  });
});
