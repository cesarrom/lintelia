import { describe, expect, test } from 'bun:test';
import { SYSTEM_ROLE_KEYS } from '@repo/lintelia/schemas';
import { parseDefinition, renderCaseTitle } from '../src/engine/definition';
import { validateDefinition } from '../src/engine/components/validation';
import { evaluate, interpolate, resolveConfig } from '../src/engine/expressions';
import { durationMs } from '../src/engine/durations';
import { templateYaml, WORKFLOW_TEMPLATES } from '../src/engine/templates';

/** Pure parts of the case engine: definitions, templates, expressions, durations (no database, no Restate). */
describe('workflow templates', () => {
  for (const template of WORKFLOW_TEMPLATES) {
    test(`${template.id} is valid against the system roles`, () => {
      const definition = parseDefinition(templateYaml(template.id)!);
      expect(validateDefinition(definition, { roles: SYSTEM_ROLE_KEYS })).toEqual([]);
    });
  }

  test('the investigation template is hidden from the client and starts on client.flagged', () => {
    const definition = parseDefinition(templateYaml('suspicious-activity')!);
    expect(definition.clientVisibility).toBe('requests_only');
    expect(definition.startOn).toEqual(['client.flagged']);
  });

  test('case titles are rendered from caseTitle', () => {
    const yaml = templateYaml('loan-pre-approval')!;
    expect(renderCaseTitle(yaml, { fullName: 'Ada', amount: 20000 }, 'ada@example.com', interpolate)).toBe('Loan pre-approval: Ada (20000)');
  });
});

describe('definition validation', () => {
  const base = (steps: string) => `name: T\nsteps:\n${steps}`;

  test('unknown step types, dangling next steps and unknown roles are reported', () => {
    const definition = parseDefinition(base(`
  - { id: start, type: start, events: [{ name: finished, next: [review] }] }
  - { id: review, type: review, config: { assignTo: { role: wizard } }, events: [{ name: review_approved, next: [nowhere] }] }
  - { id: odd, type: teleport, events: [] }`));
    const errors = validateDefinition(definition, { roles: ['reviewer'] });
    expect(errors.join('\n')).toContain('unknown type "teleport"');
    expect(errors.join('\n')).toContain('unknown step "nowhere"');
    expect(errors.join('\n')).toContain('unknown role "wizard"');
  });

  test('exactly one start step is required', () => {
    expect(validateDefinition(parseDefinition(base('  - { id: end, type: end, events: [] }')))).toContain('A workflow needs exactly one start step (found 0)');
  });
});

describe('expressions', () => {
  const vars = { input: { amount: '60000', annualIncome: 200000, fullName: 'Bo <Big>' }, steps: { estimate: { maxAmount: 160000 } } };

  test('JSONata expressions decide routing and authority', async () => {
    expect(await evaluate("= $number(input.amount) > 50000 ? 'high' : 'standard'", vars)).toBe('high');
    expect(await resolveConfig({ assignTo: { role: "= $number(input.amount) > 50000 ? 'senior_reviewer' : 'reviewer'" } }, vars))
      .toEqual({ assignTo: { role: 'senior_reviewer' } });
  });

  test('interpolation formats values and escapes HTML when asked', () => {
    expect(interpolate('{{input.fullName}} may borrow {{steps.estimate.maxAmount}}', vars)).toBe('Bo <Big> may borrow 160000');
    expect(interpolate('{{input.fullName}}', vars, { html: true })).toBe('Bo &lt;Big&gt;');
  });

  test('a single placeholder keeps the raw value', async () => {
    expect(await resolveConfig<unknown>('{{steps.estimate}}', vars)).toEqual({ maxAmount: 160000 });
  });

  test('expressions are JSONata, not JavaScript: they cannot reach the process', async () => {
    expect(await evaluate('= $eval("process.exit()")', vars)).toBeUndefined();
    expect(await evaluate('= constructor', vars)).toBeUndefined();
  });
});

describe('durations', () => {
  test('ISO-8601 durations', () => {
    expect(durationMs('PT24H')).toBe(24 * 3600 * 1000);
    expect(durationMs('P3D')).toBe(3 * 24 * 3600 * 1000);
    expect(durationMs(undefined)).toBeNull();
  });
});
