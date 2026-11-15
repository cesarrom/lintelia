import Ajv, { type ValidateFunction } from 'ajv';
import type { ComponentDefinition } from '@repo/fintivio/schemas';
import { BUILTIN_COMPONENTS } from './builtin';
import type { EngineComponent } from './types';

/**
 * The component registry (docs/plans/01): built-in components plus those contributed by connectors (03). The editor
 * reads definitions through `GET /workflow-components`; the engine executes through `execute`; publishing validates
 * each step against `configSchema` (+ the component's own checks).
 */
const builtins = new Map(BUILTIN_COMPONENTS.map((component) => [component.definition.type, component]));

/** Connector components are resolved per tenant at run time (see integrations/connector-components.ts). */
export type ComponentResolver = (type: string) => EngineComponent | null;
const resolvers: ComponentResolver[] = [];
export const registerComponentResolver = (resolver: ComponentResolver) => resolvers.push(resolver);

export function getComponent(type: string): EngineComponent | null {
  return builtins.get(type) ?? resolvers.map((resolve) => resolve(type)).find(Boolean) ?? null;
}

export const builtinDefinitions = (): ComponentDefinition[] => BUILTIN_COMPONENTS.map((c) => c.definition);

const ajv = new Ajv({ allErrors: true, strict: false });
const compiled = new Map<string, ValidateFunction>();

/** Errors of a step config against its component (schema + custom checks); expression strings are accepted anywhere `x-expression` is set. */
export function validateComponentConfig(component: EngineComponent, config: Record<string, unknown>, context: { roles?: string[] }) {
  const key = `${component.definition.type}@${component.definition.version}`;
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile(relaxExpressions(component.definition.configSchema));
    compiled.set(key, validate);
  }
  const errors: string[] = [];
  if (!validate(config)) {
    for (const error of validate.errors ?? []) errors.push(`${error.instancePath || 'config'} ${error.message}`.trim());
  }
  errors.push(...(component.validate?.(config as Record<string, any>, context) ?? []));
  return errors;
}

/** Fields marked `x-expression` may hold `=JSONata` / `{{template}}` strings instead of the literal type. */
function relaxExpressions(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;
  const copy: any = Array.isArray(schema) ? schema.map(relaxExpressions) : { ...schema };
  if (copy.properties) copy.properties = Object.fromEntries(Object.entries(copy.properties).map(([k, v]) => [k, relaxExpressions(v)]));
  if (copy.items) copy.items = relaxExpressions(copy.items);
  if (copy.additionalProperties && typeof copy.additionalProperties === 'object') copy.additionalProperties = relaxExpressions(copy.additionalProperties);
  if (copy['x-expression'] && copy.type !== 'string') {
    const { type, enum: values, ...rest } = copy;
    return { ...rest, anyOf: [{ type, ...(values ? { enum: values } : {}) }, { type: 'string', pattern: '^\\s*(=|.*\\{\\{)' }] };
  }
  if (copy['x-expression'] && copy.enum) {
    const { enum: values, ...rest } = copy;
    return { ...rest, anyOf: [{ enum: values }, { type: 'string', pattern: '^\\s*(=|.*\\{\\{)' }] };
  }
  return copy;
}

export type { EngineComponent } from './types';
