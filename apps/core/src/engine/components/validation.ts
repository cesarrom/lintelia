import type { WorkflowDefinition } from '../definition';
import { componentEvents } from '@repo/fintivio/schemas';
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
    for (const error of validateComponentConfig(component, step.config ?? {}, context)) {
      errors.push(`${component.definition.title} "${step.name}": ${error}`);
    }
  }
  return errors;
}
