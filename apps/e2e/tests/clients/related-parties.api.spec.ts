import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus, type Session } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { applyAsClient, prepareInstitution, publishForm, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  const designer = Api.as(inst.members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CLI-09 Invite a co-applicant or guarantor', { tag: ['@client', '@CLI-09'] }, () => {
  test('the invited party joins through their own link and only sees their part', async () => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey);
    const coApplicantEmail = uniqueEmail('co-applicant', 'customers.example');
    const since = Date.now() - 1000;
    const invited = await Api.as(client).post(`/me/cases/${caseId}/parties`, { role: 'co_applicant', email: coApplicantEmail, name: 'Cole Applicant' });
    expectStatus(invited, 201);

    const mail = await waitForEmail({ tenant: inst.bank.key, to: coApplicantEmail, since });
    const { value: token } = linkWithParam(mail, 'party');
    const joined = await Api.anonymous(inst.bank.key).post<Session>('/auth/party-invitations/accept', { token });
    expectStatus(joined, 200);

    const partyView = await Api.as(joined.body).get(`/me/cases/${caseId}`);
    expectStatus(partyView, 200);
    expect(partyView.body.myRole).toBe('co_applicant');
    expect(JSON.stringify(partyView.body)).not.toContain(client.email);
    expect(partyView.body).not.toHaveProperty('answers');
  });

  test('only the applicant invites related parties', async () => {
    const { caseId } = await applyAsClient(inst.bank, publicKey);
    const { client: stranger } = await applyAsClient(inst.bank, publicKey);
    expectStatus(await Api.as(stranger).post(`/me/cases/${caseId}/parties`, { role: 'guarantor', email: uniqueEmail('g'), name: 'G' }), 404);
    expectForbidden(await inst.bank.adminApi.post(`/me/cases/${caseId}/parties`, { role: 'guarantor', email: uniqueEmail('g'), name: 'G' }));
  });
});
