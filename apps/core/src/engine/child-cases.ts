import { Inject, Injectable } from '@nestjs/common';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from './engine.client';
import type { CaseRepository } from './case-repository';
import { parseDefinition, renderCaseTitle } from './definition';
import { interpolate } from './expressions';
import { AuditWriter } from '../services/audit.writer';
import type { TaskSignal } from './components/types';

/**
 * Child cases (docs/plans/06): `workflow.call` and `foreach` start a published workflow as a child case of the
 * current one and wait on a durable promise that the child resolves when it ends.
 */
@Injectable()
export class ChildCases {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  async start(input: { tenantId: string; parentCaseId: string; parentStepId: string; workflowId: string; data: Record<string, unknown>; applicantId?: string | null; partyId?: string | null; callbackPromise: string | null }) {
    const version = await this.repository.activeVersion(input.tenantId, input.workflowId);
    if (!version) throw new Error(`Workflow ${input.workflowId} has no published version`);
    const parent = await this.repository.getCase(input.tenantId, input.parentCaseId);
    if (!parent) throw new Error('Parent case not found');
    let applicant = { id: parent.applicantId, email: parent.applicantEmail, name: parent.applicantName };
    if (input.applicantId && input.applicantId !== parent.applicantId) {
      const person = await this.repository.userById(input.tenantId, input.applicantId);
      if (person) applicant = { id: person.id, email: person.email, name: person.name };
    }
    const definition = parseDefinition(version.yaml);
    const kase = await this.repository.createCase(input.tenantId, {
      title: renderCaseTitle(version.yaml, input.data, applicant.name || applicant.email || parent.reference, interpolate),
      workflowId: input.workflowId, workflowVersion: version.version, status: 'submitted',
      applicantId: applicant.id, applicantEmail: applicant.email, applicantName: applicant.name,
      initiatedByType: 'workflow', initiatedById: parent.id, initiatedByEmail: null,
      source: `child:${input.parentStepId}`, data: input.data,
      clientVisibility: parent.clientVisibility === 'requests_only' ? 'requests_only' : definition.clientVisibility,
      parentCaseId: parent.id, parentStepId: input.parentStepId, parentPromise: input.callbackPromise,
    });
    // A party's own case: linked before it starts, so a party joining at any moment reaches it (parties.wait).
    if (input.partyId) await this.repository.updateParty(input.tenantId, input.partyId, { childCaseId: kase.id });
    await this.audit.record(input.tenantId, { type: 'workflow' }, 'case.child_started', { type: 'case', id: kase.id, reference: kase.reference }, { parent: parent.reference, step: input.parentStepId }, parent.id);
    await this.engine.start(input.tenantId, kase.id);
    return { caseId: kase.id, reference: kase.reference };
  }

  /** A child case ended: resolve the parent's waiting promise with its result. */
  async notifyParent(tenantId: string, childCaseId: string, signal: TaskSignal) {
    const child = await this.repository.getCase(tenantId, childCaseId);
    if (!child?.parentCaseId || !child.parentPromise) return;
    await this.engine.resolve(tenantId, child.parentCaseId, child.parentPromise, signal);
  }
}
