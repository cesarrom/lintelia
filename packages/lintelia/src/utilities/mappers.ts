import { TriggerDefinition } from "../schemas/shared.schema";
import { SystemTrigger } from "../schemas/tenants.schema";
import { v4 as uuid } from 'uuid';

export const fromTriggerDefinition = (trigger: TriggerDefinition, {
  createdBy,
  workflowId,
  active,
}: {
  createdBy: string;
  workflowId: string;
  active: boolean
}): SystemTrigger => {
  return {
    id: trigger.id || uuid(),
    name: trigger.name,
    description: trigger.description || '',
    isActive: active,
    pattern: trigger.pattern,
    action: trigger.action,
    createdBy: createdBy,
    workflowId: workflowId,
  } as SystemTrigger;
}