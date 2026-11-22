import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { applyAsClient, prepareInstitution, publishForm, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', mlro: 'compliance_officer' } });
  const designer = Api.as(inst.members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CLI-10 Give consent and exercise data rights', { tag: ['@client', '@CLI-10'] }, () => {
  test('submitting an application records which privacy notice version was accepted, and when', async () => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { consent: { privacyNotice: '2026-01' } });
    const kase = await Api.as(client).get(`/me/cases/${caseId}`);
    expectStatus(kase, 200);
    expect(kase.body.consents).toEqual([expect.objectContaining({ document: 'privacy_notice', version: '2026-01', acceptedAt: expect.any(String) })]);
  });

  test('a client can request a copy of their data and its erasure', async () => {
    const { client } = await applyAsClient(inst.bank, publicKey);
    const me = Api.as(client);
    const exportRequest = await me.post('/me/data-requests', { type: 'export' });
    const erasure = await me.post('/me/data-requests', { type: 'erasure' });
    expectStatus(exportRequest, 202);
    expectStatus(erasure, 202);
    const mine = await me.get('/me/data-requests');
    expect((mine.body as any[]).map((r) => r.type).sort()).toEqual(['erasure', 'export']);
    const queue = await Api.as(inst.members.mlro).get('/data-requests');
    expect((queue.body as any[]).filter((r) => r.client.email === client.email)).toHaveLength(2);
  });
});
