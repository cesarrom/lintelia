import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { Api, expectStatus } from './api';

/** A minimal valid workflow in today's YAML format: start -> end. */
export const minimalWorkflowYaml = (name: string) => `schemaVersion: "1"
name: ${name}
description: e2e minimal workflow
version: 1
triggers: []
inputs: []
steps:
  - id: start
    name: Start
    type: start
    events:
      - name: finished
        outputs: []
        next: [end]
  - id: end
    name: End
    type: end
    isTerminal: true
    events:
      - name: done
        outputs: []
        next: []
`;

/**
 * Load a workflow definition from fixtures/workflows and substitute `${NAME}` placeholders (connection ids, roles).
 * Fixtures use the target component names from docs/architecture/integrations.md.
 */
export function workflowFixture(name: string, values: Record<string, string> = {}) {
  let yaml = readFileSync(join(import.meta.dirname, '../fixtures/workflows', `${name}.yaml`), 'utf8');
  for (const [key, value] of Object.entries(values)) yaml = yaml.replaceAll('${' + key + '}', value);
  const missing = yaml.match(/\$\{[A-Z_]+\}/g);
  if (missing) throw new Error(`Workflow fixture ${name} has unresolved placeholders: ${missing.join(', ')}`);
  return yaml;
}

/** Create a workflow draft and publish it (DES-02). Returns the workflow id. */
export async function publishWorkflow(api: Api, yaml: string): Promise<string> {
  const created = await api.post('/workflows', { yaml });
  expectStatus(created, 201);
  const published = await api.post(`/workflows/${created.body.id}/publish`);
  expectStatus(published, 200);
  expect(published.body.status).toBe('active');
  return created.body.id;
}

/** A form with a name and an e-mail field (today's form config format). */
export const simpleFormConfig = (name: string) => ({
  id: name,
  name,
  variables: {},
  components: [
    { id: 'fullName', type: 'text', config: { type: 'text', label: 'Full name', propertyName: 'fullName', required: true } },
    { id: 'email', type: 'email', config: { type: 'email', label: 'E-mail', propertyName: 'email', required: true } },
  ],
});

/**
 * A journey screen with the building blocks of docs/plans/14: a slider, a calculated value, a field shown on a
 * condition, an IBAN, a reference with a pattern, a one-time code and a handwritten signature.
 */
export function screenBlocksWorkflowYaml(name: string) {
  return `schemaVersion: "1"
name: ${name}
description: e2e screen building blocks
caseTitle: "Blocks: {{applicant}}"
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [form] }] }
  - id: form
    name: Form
    type: client.screen
    config:
      title: Your loan
      fields:
        - { key: months, label: Term (months), type: slider, min: 6, max: 60, step: 6, required: true }
        - { key: monthly, label: Monthly payment, type: display, expression: "$round(6000 / months, 2)", format: money }
        - { key: reason, label: Why so long?, type: text, required: true, visibleIf: "months > 36" }
        - { key: iban, label: IBAN, type: text, required: true, check: iban }
        - { key: ref, label: Reference, type: text, pattern: "^[A-Z]{3}-[0-9]+$", patternMessage: "like ABC-123" }
        - { key: code, label: Code we sent you, type: otp, length: 6, required: true }
        - { key: signature, label: Your signature, type: signature }
      buttons: [{ key: continue, label: Continue, style: primary }]
    events: [{ name: continue, outputs: [], next: [done] }]
  - id: done
    name: Done
    type: case.decision
    config: { status: completed, outcome: done, notifyApplicant: false }
    isTerminal: true
    events: [{ name: done, outputs: [], next: [] }]
`;
}
