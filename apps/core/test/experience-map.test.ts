import { describe, expect, test } from 'bun:test';
import { workflowMap, type ComponentInfo } from '../src/experience-map/model';
import { dealerFinanceYaml, fillPlaceholders } from '../src/solutions/dealer-finance';
import { bankingWorkflowYaml } from '../src/client-apps/templates';

/** The experience map's view of workflows (docs/plans/13): touchpoints and the flow between them. */
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const VALUES = {
  AI: uuid(1), LOANPRO: uuid(2), DOCUMENSO: uuid(3), SHEETS: uuid(4), QUICKBOOKS: uuid(5), SPREADSHEET_ID: 'deal-log', QBO_REALM: '123', DEALER_FEE: '395',
  FN_LOG_DEAL: uuid(6), FN_PAY_DEALER: uuid(7), WF_TITLE: uuid(8),
};

/** The catalogue as the core describes it: client steps are touchpoints; Documenso's signature is one too. */
const describe_ = (type: string): ComponentInfo | null => {
  if (['client.screen', 'client.request', 'form.request', 'parties.collect'].includes(type)) return { title: type, kind: 'client', category: 'client' };
  if (type === 'connector:documenso/signature.request') return { title: 'Sign a document', kind: 'client', category: 'connector', connectorId: 'documenso', connectorName: 'Documenso' };
  if (type.startsWith('connector:')) return { title: type, kind: 'automatic', category: 'connector', connectorId: type.slice(10).split('/')[0], connectorName: type.slice(10).split('/')[0] };
  if (type.startsWith('function:')) return { title: 'A function', kind: 'automatic', category: 'function' };
  if (type === 'review' || type === 'task') return { title: type, kind: 'human', category: 'people' };
  return { title: type, kind: 'automatic', category: 'flow' };
};

const deal = () => workflowMap({ id: uuid(20), name: 'Dealer: deal', yaml: fillPlaceholders(dealerFinanceYaml('submit_deal'), VALUES), status: 'active', activeVersion: 1 }, describe_);

describe('experience map: workflows', () => {
  test('touchpoints are what the client sees, in the workflow', () => {
    const map = deal();
    expect(map.touchpoints.map((t) => `${t.kind}:${t.stepId}`)).toEqual([
      'screen:deal', 'screen:docs', 'screen:conditions', 'action:buyer_signs', 'action:dealer_signs', 'request:funding_package',
    ]);
    const docs = map.touchpoints.find((t) => t.stepId === 'docs')!;
    expect(docs.buttons.map((b) => b.label)).toEqual(['Submit the deal', 'Back']);
    expect(docs.fields.map((f) => `${f.key}:${f.type}`)).toEqual(['payStub:file', 'buyersOrder:file', 'license:file']);
    expect(map.touchpoints.find((t) => t.stepId === 'buyer_signs')!.connector).toEqual({ id: 'documenso', name: 'Documenso', component: 'Sign a document' });
  });

  test('the flow goes from touchpoint to touchpoint through what happens in between, with the branches', () => {
    const map = deal();
    const from = (id: string, event: string) => map.flow.filter((f) => f.from === id && f.event === event);
    expect(from('@start', 'finished').map((f) => f.to)).toEqual(['deal']);
    expect(from('deal', 'continue').map((f) => f.to)).toEqual(['docs']);
    expect(from('docs', 'back').map((f) => f.to)).toEqual(['deal']);
    const submitted = from('docs', 'submit');
    expect(submitted.map((f) => `${f.to} (${f.branch})`).sort()).toEqual([
      '@end:rejected:declined (Credit decision: Decline)', 'buyer_signs (Credit decision: Approve)', 'conditions (Credit decision: Approve with conditions)',
    ]);
    const via = submitted.find((f) => f.to === 'buyer_signs')!.via;
    expect(via.filter((v) => v.group !== 'auto').map((v) => `${v.group}:${v.name}`)).toEqual([
      'connector:Read the pay stub (AI)', "connector:Read the buyer's order (AI)", 'connector:Summary for the analyst (AI)', 'function:Log the deal', 'people:Credit decision', 'notify:Tell the dealer',
    ]);
    expect(via.find((v) => v.name === 'Credit decision')).toMatchObject({ detail: 'Reviewer', asksClient: true });
    // An AI step whose three outcomes lead to the same next step is not a branch.
    expect(submitted.every((f) => !f.branch?.startsWith('Read'))).toBe(true);
    expect(map.ends.map((e) => e.label).sort()).toEqual(['Declined', 'Funded', 'Withdrawn by dealer']);
  });

  test('calls, people, systems and signals are listed', () => {
    const map = deal();
    expect(map.calls.map((c) => `${c.kind}:${c.workflowId}:${c.wait}`)).toEqual(expect.arrayContaining([`function:${uuid(6)}:true`, `function:${uuid(7)}:true`, `call:${uuid(8)}:false`]));
    expect([...new Set(map.people.map((p) => p.role))]).toEqual(['reviewer', 'senior_reviewer']);
    expect([...new Set(map.connectors.map((c) => c.connectorId))].sort()).toEqual(['ai', 'documenso', 'loanpro']);
    expect(map.stages.map((s) => s.key)).toContain('underwriting');
    const title = workflowMap({ id: uuid(21), name: 'Title', yaml: fillPlaceholders(dealerFinanceYaml('WF_TITLE'), VALUES), status: 'active', activeVersion: 1 }, describe_);
    expect(title.signals.map((s) => `${s.signal}:${s.timeout}`)).toEqual(['title_received:P45D', 'title_received:P30D']);
    expect(title.touchpoints).toEqual([]);
  });

  test('a banking journey: screens, a check in between, the outcome', () => {
    const transfer = workflowMap({ id: uuid(22), name: 'Transfer', yaml: bankingWorkflowYaml('transfer'), status: 'active', activeVersion: 1 }, describe_);
    expect(transfer.touchpoints.map((t) => t.stepId)).toEqual(['form', 'problem', 'confirm']);
    expect(transfer.flow.filter((f) => f.from === 'form').map((f) => `${f.to}|${f.branch}`).sort()).toEqual(['confirm|Possible?: yes', 'problem|Possible?: no']);
    expect(transfer.notifies).toEqual([{ stepId: 'notify', name: 'Tell the client', page: 'accounts', title: 'Money moved' }]);
  });

  test('broken YAML is reported, not thrown', () => {
    expect(workflowMap({ id: uuid(23), name: 'Broken', yaml: 'steps: [', status: 'draft', activeVersion: null }, describe_).error).toContain('does not parse');
  });
});
