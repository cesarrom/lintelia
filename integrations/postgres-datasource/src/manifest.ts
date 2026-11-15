import type { ManifestInput } from '@repo/connector-sdk';

export const manifest: ManifestInput = {
  id: 'postgres-datasource',
  version: '1.0.0',
  name: 'PostgreSQL data source',
  description: "Look up data in your institution's own PostgreSQL database (parameterised, read-only unless you allow changes).",
  publisher: { name: 'Fintivio', url: 'https://fintivio.dev', support: 'support@lintelia.example' },
  categories: ['data'],
  icon: 'Database',
  audiences: ['tenant'],
  scopes: ['installation:write'],
  components: [
    {
      key: 'query.run',
      version: 1,
      kind: 'action',
      title: 'Query your database',
      description: 'Run a parameterised SQL query and use the rows in the next steps.',
      icon: 'Database',
      category: 'data',
      configSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', title: 'SQL query', 'x-widget': 'textarea', description: 'named parameters, e.g. select score from credit_scores where customer_id = :customerId' },
          params: { type: 'object', title: 'Parameters', description: 'values for the named parameters, e.g. customerId: {{input.customerId}}', additionalProperties: { type: 'string' } },
          maxRows: { type: 'integer', title: 'Maximum rows', default: 100, minimum: 1, maximum: 1000 },
        },
      },
      inputSchema: { type: 'object', properties: {} },
      summary: 'Query via {{connection}}',
      events: ['success', 'failed'],
      invoke: { url: '', mode: 'sync' },
      dataClasses: ['institution_data'],
    },
  ],
  triggers: [],
  egress: ["the institution's PostgreSQL server"],
  dataHandling: { stores: ['connection settings', 'password (encrypted)'], retention: 'deleted when the connection is removed', regions: [] },
};
