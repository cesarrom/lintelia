import type { WorkflowDefinition } from '../definition';
import { componentEvents } from '@repo/lintelia/schemas';
import { getComponent, validateComponentConfig } from './index';

/** Reasons a definition cannot be published (empty = valid): graph checks, then each step against its component. */
export function validateDefinition(definition: WorkflowDefinition, context: { roles?: string[] } = {}): string[] {
  const errors: string[] = [];
  const ids = new Set(definition.steps.map((s) => s.id));
  const starts = definition.steps.filter((s) => s.type === 'start');
  if (starts.length !== 1) errors.push(`A workflow needs exactly one start step (found ${starts.length})`);
  if (ids.size !== definition.steps.length) errors.push('Step ids must be unique');

  for (const step of definition.steps) {
    const component = getComponent(step.type);
    if (!component) {
      errors.push(`Step "${step.name}" has unknown type "${step.type}"`);
      continue;
    }
    // Outgoing events must be ones the component can emit, or the branch would silently never run.
    const emitted = new Set(componentEvents(component.definition, step.config ?? {}));
    const aliases = component.definition.events.aliases ?? {};
    for (const event of step.events) {
      for (const next of event.next) {
        if (!ids.has(next)) errors.push(`Step "${step.name}" event "${event.name}" points to unknown step "${next}"`);
      }
      if (event.next.length && emitted.size && !emitted.has(event.name) && !(event.name in aliases) && !Object.values(aliases).includes(event.name)) {
        errors.push(`Step "${step.name}" has an event "${event.name}" that ${component.definition.title} never emits (it emits: ${[...emitted].join(', ')})`);
      }
    }
    // Stages must be declared (the board, the case page and clients show their labels).
    const stage = step.type === 'case.update' ? step.config?.stage : undefined;
    if (typeof stage === 'string' && stage && !stage.trim().startsWith('=') && !stage.includes('{{') && !definition.stages.some((s) => s.key === stage)) {
      errors.push(`Step "${step.name}" moves the case to the stage "${stage}", which the workflow does not declare (stages: ${definition.stages.map((s) => s.key).join(', ') || 'none'})`);
    }
    for (const error of validateComponentConfig(component, step.config ?? {}, context)) {
      errors.push(`${component.definition.title} "${step.name}": ${error}`);
    }
  }
  // Correlation (docs/plans/17 §3): keys named once, used by waits and start-or-deliver rules.
  const keyNames = new Set(Object.keys(definition.correlation));
  for (const step of definition.steps) {
    if (step.type === 'case.update' && step.config?.keys && typeof step.config.keys === 'object') for (const k of Object.keys(step.config.keys)) keyNames.add(k);
  }
  for (const name of keyNames) if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) errors.push(`The key "${name}" must be letters, digits and _ (starting with a letter)`);
  for (const rule of definition.startRules) {
    if (!/^[a-z0-9][a-z0-9_.:/-]{0,159}$/i.test(rule.event)) errors.push(`startOn: "${rule.event}" is not an event type`);
    for (const name of Object.keys(rule.correlate ?? {})) {
      if (!keyNames.has(name)) errors.push(`startOn "${rule.event}" correlates on "${name}", which the workflow does not declare under correlation`);
    }
  }
  for (const step of definition.steps.filter((s) => s.type === 'event.wait')) {
    for (const name of Object.keys(step.config?.match ?? {})) {
      if (!keyNames.has(name)) errors.push(`Wait for an event "${step.name}": matches on the key "${name}", which the workflow does not declare under correlation`);
    }
  }
  return errors;
}
