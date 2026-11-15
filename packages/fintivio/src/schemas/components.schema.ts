/**
 * Workflow component catalogue (docs/plans/01): one description of every step type, used by the editor (palette,
 * node rendering, configuration forms), the engine (publish-time validation, execution) and connectors (which
 * contribute their own components through their manifests).
 */

/** JSON Schema (2020-12 subset) with a few `x-` extensions understood by the editor's form renderer. */
export type JsonSchema = {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | Array<string>;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: readonly unknown[];
  /** Labels for `enum` values, same order. */
  'x-enum-labels'?: readonly string[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  format?: string;
  /**
   * Editor widget: `expression` (JSONata or {{templates}}), `role` (role picker), `roles`, `duration` (ISO-8601),
   * `textarea`, `form` (form picker), `workflow` (published workflow picker), `connection`, `keyValue`
   * (object of named expressions), `options` (dynamic options from a connector).
   */
  'x-widget'?: string;
  /** The field accepts `= JSONata` expressions or `{{templates}}` in addition to literal values. */
  'x-expression'?: boolean;
  /** Dynamic options source for connector components (`/options/<name>`). */
  'x-options'?: string;
  [key: string]: unknown;
};

export type ComponentCategory = 'flow' | 'data' | 'people' | 'client' | 'case' | 'communication' | 'connector';
export type ComponentKind = 'automatic' | 'human' | 'client' | 'timer' | 'container';

export interface ComponentDefinition {
  /** Step `type` in the workflow YAML, e.g. `review` or `connector:didit/kyc.verify`. */
  type: string;
  version: number;
  title: string;
  description: string;
  /** lucide-react icon name (built-ins) or an absolute URL (connectors). */
  icon: string;
  category: ComponentCategory;
  kind: ComponentKind;
  source: { kind: 'builtin' } | { kind: 'connector'; connectorId: string; installationId?: string; installationName?: string };
  configSchema: JsonSchema;
  /** Default configuration of a new step. */
  defaults?: Record<string, unknown>;
  /** What the step adds to `steps.<id>` (autocomplete, documentation). */
  outputSchema?: JsonSchema;
  /**
   * Events (outgoing handles). `fromConfig` names an array in the config whose items' `key` become events
   * (review outcomes); `defaults` are used when that array is empty.
   */
  events: { static?: string[]; fromConfig?: string; defaults?: string[]; aliases?: Record<string, string | null> };
  /** One-line summary template rendered on the node, e.g. "Queue {{assignTo.role}} · SLA {{sla}}". */
  summary?: string;
  /** Not offered in the palette (e.g. `start`, which every workflow has exactly one of). */
  hidden?: boolean;
  docsUrl?: string;
}

/** Event names of a step of this component with the given config. */
export function componentEvents(definition: Pick<ComponentDefinition, 'events'>, config: Record<string, unknown> | undefined): string[] {
  const events = [...(definition.events.static ?? [])];
  if (definition.events.fromConfig) {
    const list = (config?.[definition.events.fromConfig] as Array<{ key?: string }> | undefined) ?? [];
    const aliases = definition.events.aliases ?? {};
    const keys = list.map((item) => item?.key).filter((key): key is string => !!key)
      .map((key) => (key in aliases ? aliases[key] : key)).filter((key): key is string => !!key);
    events.push(...(keys.length ? keys : definition.events.defaults ?? []));
  }
  return [...new Set(events)];
}
