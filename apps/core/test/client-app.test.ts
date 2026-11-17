import { describe, expect, test } from 'bun:test';
import { SYSTEM_ROLE_KEYS, validateClientApp, BLANK_CLIENT_APP, ordered, withKeyOrder } from '@repo/fintivio/schemas';
import { parseDefinition } from '../src/engine/definition';
import { validateDefinition } from '../src/engine/components/validation';
import { interpolate, resolveConfig } from '../src/engine/expressions';
import { bankingApp, bankingWorkflowYaml } from '../src/client-apps/templates';
import { checkExpression } from '../src/client-apps/studio.service';

/** Client apps (docs/plans/11): the banking template, app validation, template formats — no database, no Restate. */
const JOURNEYS = ['welcome', 'open_current', 'open_savings', 'personal_loan', 'transfer', 'pay_qr', 'card_freeze', 'report_lost', 'update_address', 'contact_us'];
const ids = Object.fromEntries(JOURNEYS.map((j, i) => [j, `00000000-0000-4000-8000-00000000000${i}`]));
const workflows = JOURNEYS.map((j) => ({ id: ids[j], name: j, active: true }));

describe('banking template', () => {
  for (const journey of JOURNEYS) {
    test(`the ${journey} workflow is a valid workflow`, () => {
      const definition = parseDefinition(bankingWorkflowYaml(journey));
      expect(validateDefinition(definition, { roles: SYSTEM_ROLE_KEYS })).toEqual([]);
    });
  }

  test('the banking app is valid, expressions included', () => {
    expect(validateClientApp(bankingApp(ids, 'Test Bank'), { workflows, checkExpression })).toEqual([]);
  });

  test('the welcome workflow starts on client.registered and never shows a case', () => {
    const definition = parseDefinition(bankingWorkflowYaml('welcome'));
    expect(definition.startOn).toEqual(['client.registered']);
    expect(definition.clientVisibility).toBe('requests_only');
  });
});

describe('app validation', () => {
  const app = () => structuredClone(bankingApp(ids, 'Test Bank'));

  test('references to unknown pages, journeys and collections are reported', () => {
    const broken = app();
    broken.navigation.push({ page: 'ghost', label: 'Ghost' });
    broken.pages.home.widgets.push({ id: 'x1', type: 'list', props: { source: 'records:policies' } });
    broken.pages.home.widgets.push({ id: 'x2', type: 'button', props: { label: 'Go', journey: 'teleport' } });
    broken.pages.home.widgets.push({ id: 'x3', type: 'embed', props: { url: 'http://evil.example/' } });
    const errors = validateClientApp(broken, { workflows, checkExpression }).join('\n');
    expect(errors).toContain('navigation "Ghost" opens the unknown page "ghost"');
    expect(errors).toContain('reads "records:policies", which is not a declared collection');
    expect(errors).toContain('starts the unknown journey "teleport"');
    expect(errors).toContain('the address must start with https://');
  });

  test('unpublished workflows and JSONata mistakes are reported', () => {
    const broken = app();
    broken.pages.home.widgets[0].visibleIf = "not('customer' in me.segments)";
    broken.journeys.transfer.eligibility = "'customer' in segments and";
    const errors = validateClientApp(broken, { workflows: workflows.map((w) => (w.id === ids.transfer ? { ...w, active: false } : w)), checkExpression });
    expect(errors.join('\n')).toContain('use $not(…)');
    expect(errors.join('\n')).toMatch(/journey "transfer" \(who may start it\): .+ in "'customer' in segments and"/);
    expect(errors.join('\n')).toContain('journey "transfer" runs "transfer", which is not published');
  });

  test('embedding accepts site origins only', () => {
    const app1 = app();
    app1.embed.allowedOrigins = ['https://www.bank.example', 'http://bank.localhost:4000', 'https://www.bank.example/path', '*'];
    const errors = validateClientApp(app1, { workflows, checkExpression });
    expect(errors).toEqual(['embedding: "https://www.bank.example/path" is not a site origin (https://host[:port])', 'embedding: "*" is not a site origin (https://host[:port])']);
  });

  test('the authored order of pages and journeys survives storage', () => {
    const stored = withKeyOrder({ ...BLANK_CLIENT_APP, pages: { zeta: { title: 'Z', widgets: [] }, alpha: { title: 'A', widgets: [] } } });
    // JSONB sorts keys; the order list keeps the designer's.
    const reloaded = { ...stored, pages: { alpha: stored.pages.alpha, zeta: stored.pages.zeta } };
    expect(ordered(reloaded.pages, reloaded.pageOrder).map(([k]) => k)).toEqual(['zeta', 'alpha']);
  });
});

describe('template formats', () => {
  test('values are formatted after a pipe', async () => {
    const vars = { steps: { offer: { monthly: 1234.5, amount: 10000 } }, input: { date: '2026-03-04' } };
    expect(interpolate('£{{ steps.offer.monthly | money }} a month for £{{steps.offer.amount|money}}', vars)).toBe('£1,234.50 a month for £10,000.00');
    expect(interpolate('{{ steps.offer.amount | number }} on {{ input.date | date }}', vars)).toBe('10,000 on 4 March 2026');
    expect(interpolate('{{ steps.offer.monthly }}', vars)).toBe('1234.50');
    // A single placeholder with a format is text; without one it keeps the raw value.
    expect(await resolveConfig('{{ steps.offer.amount | money }}', vars)).toBe('10,000.00');
    expect(await resolveConfig<unknown>('{{ steps.offer.amount }}', vars)).toBe(10000);
  });
});
