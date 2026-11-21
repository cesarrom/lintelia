import { expect } from '@playwright/test';
import { Api, expectStatus } from './api';
import { prepareInstitution, type Institution } from './scenario';
import { FakeWebsite } from './website';
import { publishWorkflow, simpleFormConfig, workflowFixture } from './workflows';
import { demoMember } from './demo';

export const ACCOUNT_FORM = 'Open an account';

/**
 * A retail-account-opening institution for the demo videos: identity (Didit) and signature (Documenso) fakes, the
 * published retail-account-opening workflow, a two-field form embedded on the (styled) bank website, and named
 * team members. Built unrecorded.
 */
export async function accountInstitution(website: FakeWebsite, opts: { name?: string; members?: Record<string, [string, string]> } = {}) {
  const inst: Institution = await prepareInstitution({ name: opts.name ?? 'Northwind Bank', connections: ['didit', 'documenso'] });
  const members: Record<string, Awaited<ReturnType<typeof demoMember>>> = {};
  members.designer = await demoMember(inst.bank, 'Dana Designer', 'flow_designer');
  for (const [label, [fullName, role]] of Object.entries(opts.members ?? {})) members[label] = await demoMember(inst.bank, fullName, role);
  const designer = Api.as(members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('retail-account-opening', {
    DIDIT: inst.connections.didit, DOCUMENSO: inst.connections.documenso, REMIND_AFTER: 'P3D', EXPIRES_AFTER: 'P30D',
  }));
  const form = await designer.post('/forms', { name: ACCOUNT_FORM, config: simpleFormConfig('open-account') });
  expectStatus(form, [200, 201]);
  const published = await designer.post(`/forms/${form.body.id}/publish`, { workflowId, allowedOrigins: [website.origin] });
  expectStatus(published, 200);
  const snippet = published.body.embed.script as string;
  return { inst, members, snippet, workflowId, publicKey: published.body.publicKey as string };
}

/** The case id for a reference, as the institution's administrator sees it. */
export async function caseIdOf(inst: Institution, reference: string) {
  const found = await inst.bank.adminApi.get(`/cases?search=${encodeURIComponent(reference)}`);
  expectStatus(found, 200);
  const id = (found.body as any[])[0]?.id;
  expect(id, 'case for reference').toBeTruthy();
  return id as string;
}
