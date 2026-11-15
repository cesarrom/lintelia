import { z } from 'zod';

/**
 * Connector manifests (docs/plans/03): the contract between the core and a connector service. Served by each
 * connector at `/.well-known/fintivio-connector.json`, kept (versioned, approved) in the core's registry.
 */

const jsonSchema = z.record(z.unknown());

export const connectorComponentSchema = z.object({
  /** Unique within the connector; the workflow step type is `connector:<connector id>/<key>`. */
  key: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  version: z.number().int().positive().default(1),
  /** `action`: runs and answers (sync) or completes later (async); `client_step`: needs the client (portal). */
  kind: z.enum(['action', 'client_step']),
  title: z.string().min(1),
  description: z.string().default(''),
  icon: z.string().optional(),
  category: z.enum(['data', 'people', 'client', 'case', 'communication', 'connector']).default('connector'),
  /** Static configuration of the step (JSON Schema; `x-options` for dynamic options). */
  configSchema: jsonSchema.default({ type: 'object', properties: {} }),
  /** Inputs mapped from the case context (each property becomes an expression field). */
  inputSchema: jsonSchema.default({ type: 'object', properties: {} }),
  outputSchema: jsonSchema.optional(),
  defaults: z.record(z.unknown()).optional(),
  summary: z.string().optional(),
  /** Outcomes of the step (events in the workflow). */
  events: z.array(z.string()).min(1),
  invoke: z.object({
    url: z.string(),
    mode: z.enum(['sync', 'async']),
    /** ISO-8601; async steps emit `expired` after it. */
    timeout: z.string().optional(),
  }),
  dataClasses: z.array(z.string()).default([]),
});

export const connectorManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1),
  description: z.string().default(''),
  publisher: z.object({ name: z.string(), url: z.string().optional(), support: z.string().optional() }),
  categories: z.array(z.string()).default([]),
  icon: z.string().optional(),
  audiences: z.array(z.enum(['platform', 'tenant', 'client'])).min(1),
  baseUrl: z.string().url(),
  auth: z.object({ jwksUrl: z.string() }),
  scopes: z.array(z.string()).default([]),
  lifecycle: z.object({ url: z.string(), events: z.array(z.string()).default([]) }).optional(),
  ui: z.object({
    connect: z.object({ url: z.string(), mode: z.enum(['redirect', 'embedded']).default('redirect') }),
    setup: z.object({ url: z.string(), mode: z.enum(['redirect', 'embedded']).default('embedded') }).optional(),
    docs: z.object({ url: z.string() }).optional(),
  }),
  options: z.object({ url: z.string() }).optional(),
  components: z.array(connectorComponentSchema).default([]),
  triggers: z.array(z.object({ key: z.string(), title: z.string(), description: z.string().optional() })).default([]),
  egress: z.array(z.string()).default([]),
  dataHandling: z.object({ stores: z.array(z.string()).default([]), retention: z.string().optional(), regions: z.array(z.string()).default([]) }).optional(),
});

export type ConnectorManifest = z.infer<typeof connectorManifestSchema>;
export type ConnectorComponentManifest = z.infer<typeof connectorComponentSchema>;

/** Scopes a connector installation can be granted on the connector API. */
export const CONNECTOR_SCOPES: Record<string, string> = {
  'installation:write': 'Report its status and non-secret configuration',
  'records:write': 'Write results to cases (verifications, signature requests, messages)',
  'events:publish': 'Publish events that can start workflows',
  'files:write': 'Attach documents to cases',
  'clients:read_basic': "Read the name and e-mail of the people its steps are about",
};

/** Step type of a connector component. */
export const connectorComponentType = (connectorId: string, key: string) => `connector:${connectorId}/${key}`;

export function parseConnectorComponentType(type: string): { connectorId: string; key: string } | null {
  const match = type.match(/^connector:([a-z0-9-]+)\/(.+)$/);
  return match ? { connectorId: match[1], key: match[2] } : null;
}

/** Canonical case records connectors write (docs/plans/03 §Canonical entities). */
export const CASE_RECORD_TYPES = ['verification', 'signature_request', 'message', 'screening_result', 'document'] as const;
export type CaseRecordType = (typeof CASE_RECORD_TYPES)[number];
