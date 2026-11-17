import { describe, expect, test } from 'bun:test';
import { SYSTEM_ROLE_KEYS, validateClientApp, withKeyOrder } from '@repo/fintivio/schemas';
import { parseDefinition } from '../src/engine/definition';
import { validateDefinition } from '../src/engine/components/validation';
import { hookToken, verifyHookToken, SIGNAL_NAME } from '../src/engine/signals';
import { dealerFinanceApp, dealerFinanceYaml, fillPlaceholders, type DealerFinanceWorkflow } from '../src/solutions/dealer-finance';
import { checkExpression } from '../src/client-apps/studio.service';

/** Automation building blocks and the dealer finance solution (docs/plans/12) — no database, no Restate. */
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const FILES: DealerFinanceWorkflow[] = ['FN_LOG_DEAL', 'FN_PAY_DEALER', 'WF_TITLE', 'payment_posted', 'delinquency', 'paid_off', 'make_payment', 'payoff', 'hardship', 'dealer_signup', 'submit_deal'];
const VALUES = {
  AI: uuid(1), LOANPRO: uuid(2), DOCUMENSO: uuid(3), SHEETS: uuid(4), QUICKBOOKS: uuid(5), SPREADSHEET_ID: 'deal-log', QBO_REALM: '123', DEALER_FEE: '395',
  FN_LOG_DEAL: uuid(6), FN_PAY_DEALER: uuid(7), WF_TITLE: uuid(8),
};

describe('signals', () => {
  test('a hook token is bound to the tenant, the case and the signal name', () => {
    const token = hookToken(uuid(1), uuid(2), 'title_received');
    expect(verifyHookToken(token, uuid(1), uuid(2), 'title_received')).toBe(true);
    expect(verifyHookToken(token, uuid(1), uuid(2), 'other')).toBe(false);
    expect(verifyHookToken(token, uuid(1), uuid(3), 'title_received')).toBe(false);
    expect(verifyHookToken(token, uuid(9), uuid(2), 'title_received')).toBe(false);
    expect(verifyHookToken(`${token.slice(0, -1)}x`, uuid(1), uuid(2), 'title_received')).toBe(false);
    expect(verifyHookToken('', uuid(1), uuid(2), 'title_received')).toBe(false);
  });

  test('signal names are lower-case identifiers', () => {
    expect(SIGNAL_NAME.test('title_received')).toBe(true);
    expect(SIGNAL_NAME.test('Title')).toBe(false);
    expect(SIGNAL_NAME.test('a/b')).toBe(false);
  });
});

describe('stages, functions and outputs in a definition', () => {
  const yaml = `schemaVersion: "1"
name: F
description: d
function: true
stages: [{ key: one, label: One }, { key: out, label: Out, exit: true }]
outputs: { total: "= steps.calc.total" }
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [move] }] }
  - { id: move, name: Move, type: case.update, config: { stage: two }, events: [{ name: done, outputs: [], next: [] }] }
`;
  test('are parsed', () => {
    const definition = parseDefinition(yaml);
    expect(definition.function).toBe(true);
    expect(definition.stages).toEqual([{ key: 'one', label: 'One' }, { key: 'out', label: 'Out', exit: true }]);
    expect(definition.outputs).toEqual({ total: '= steps.calc.total' });
  });

  test('a step moving to an undeclared stage is an error; expressions are not checked', () => {
    expect(validateDefinition(parseDefinition(yaml), { roles: SYSTEM_ROLE_KEYS })).toEqual([
      'Step "Move" moves the case to the stage "two", which the workflow does not declare (stages: one, out)',
    ]);
    expect(validateDefinition(parseDefinition(yaml.replace('stage: two', 'stage: "= input.next"')), { roles: SYSTEM_ROLE_KEYS })).toEqual([]);
  });

  test('a review may branch on its short outcome names', () => {
    const definition = parseDefinition(`schemaVersion: "1"
name: R
description: d
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [review] }] }
  - { id: review, name: Review, type: review, config: { assignTo: { role: reviewer } }, events: [{ name: approve, outputs: [], next: [] }, { name: reject, outputs: [], next: [] }] }
`);
    expect(validateDefinition(definition, { roles: SYSTEM_ROLE_KEYS })).toEqual([]);
  });
});

describe('dealer finance solution', () => {
  test('placeholders: upper-case keys are filled, money templates left alone, unknown keys refused', () => {
    expect(fillPlaceholders('a ${AI} b ${{steps.x | money}}', { AI: 'id-1' })).toBe('a id-1 b ${{steps.x | money}}');
    expect(() => fillPlaceholders('${NOPE}', {})).toThrow('Missing value for ${NOPE}');
  });

  for (const file of FILES) {
    test(`${file} is a valid workflow once filled (connector steps aside)`, () => {
      const definition = parseDefinition(fillPlaceholders(dealerFinanceYaml(file), VALUES));
      const errors = validateDefinition(definition, { roles: SYSTEM_ROLE_KEYS }).filter((e) => !/unknown type "connector:/.test(e));
      expect(errors).toEqual([]);
    });
  }

  test('the functions are functions with outputs; servicing starts on LoanPro events', () => {
    expect(parseDefinition(fillPlaceholders(dealerFinanceYaml('FN_PAY_DEALER'), VALUES))).toMatchObject({ function: true, outputs: expect.objectContaining({ paid: expect.any(String) }) });
    expect(parseDefinition(fillPlaceholders(dealerFinanceYaml('payment_posted'), VALUES)).startOn).toEqual(['connector:loanpro/payment.posted']);
    expect(parseDefinition(fillPlaceholders(dealerFinanceYaml('delinquency'), VALUES)).startOn).toEqual(['connector:loanpro/loan.delinquent']);
    expect(parseDefinition(fillPlaceholders(dealerFinanceYaml('paid_off'), VALUES)).startOn).toEqual(['connector:loanpro/loan.paid_off']);
  });

  test('the portal is a valid client app whose journeys use the solution\'s workflows', () => {
    const ids = Object.fromEntries(FILES.map((f, i) => [f, uuid(20 + i)]));
    const app = dealerFinanceApp(ids, 'Test Auto');
    const workflows = Object.values(ids).map((id) => ({ id, name: id, active: true }));
    expect(validateClientApp(app, { workflows, checkExpression })).toEqual([]);
    expect(Object.keys(app.journeys)).toEqual(['submit_deal', 'dealer_signup', 'make_payment', 'payoff', 'hardship']);
    expect(app.journeys.submit_deal.workflowId).toBe(ids.submit_deal);
  });
});

describe('key order of stored client apps', () => {
  test('a definition read back from JSONB keeps the authored order it carries', () => {
    const stored = { pages: { help: {}, home: {} }, journeys: { payoff: {}, make_payment: {} }, pageOrder: ['home', 'help'], journeyOrder: ['make_payment', 'payoff'] };
    expect(withKeyOrder(stored)).toMatchObject({ pageOrder: ['home', 'help'], journeyOrder: ['make_payment', 'payoff'] });
    expect(withKeyOrder({ pages: { a: {}, b: {} }, journeys: {} })).toMatchObject({ pageOrder: ['a', 'b'], journeyOrder: [] });
    expect(withKeyOrder({ pages: { a: {}, c: {} }, pageOrder: ['b', 'c'] })).toMatchObject({ pageOrder: ['c', 'a'] });
  });
});
