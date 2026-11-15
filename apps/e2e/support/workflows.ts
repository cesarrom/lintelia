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
