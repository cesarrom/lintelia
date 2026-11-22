import { TriggerBuilder } from "../triggers";
import { 
  AppEvent, 
  BaseEventData, 
  CreateEventOptions, 
  ListenerConfig, 
  LogEntry
} from "./types";

/**
 * Extracts entity reference from event data if available
 * @param data Event data that might contain an entity reference
 * @param getEntityRef Optional function to extract entity reference from data
 */
function extractEntityRef<T extends object, K extends object = T>(
  data: T,
  getEntityRef?: (data: T) => K | undefined
): K | undefined {
  // Try to get entity reference from the provided function
  if (getEntityRef) {
    return getEntityRef(data);
  }
  
  // Fall back to checking for entity property
  if ('entity' in data && data.entity) {
    return data.entity as unknown as K;
  }
  
  return undefined;
}
export function createEvent<T extends object, C extends ListenerConfig<any> = ListenerConfig<any>, K extends object = T>({
  name,
  category,
  level,
  source = 'system',
  userId = 'system',
  getEntityRef,
}: CreateEventOptions<T, K>): AppEvent<T, C> {
  return {
    name,
    log: (data: T): LogEntry<any> => {
      // Extract entity reference if possible
      
      // Create the base log entry with proper typing
      const logEntry: LogEntry<T | K> = {
        message: name,
        details: JSON.stringify(data),
        category,
        level,
        source,
        userId: (data as BaseEventData).userId || userId,
        metadata: getEntityRef ? getEntityRef(data) : data, // Directly use T as metadata
        acknowledged: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
            
      return logEntry;
    },
    createListener: (config: C, workflowId: string) => {
      const builder = new TriggerBuilder(`trigger-${name}`)
        .description(`Triggered when ${name} occurs`)
        .matchCategory(category)
        .matchMessage(name)
        .matchLevel(level)
        .matchSource(source)

      // Add entity type and ID to the pattern if specified
      if (config.entityType) {
        const entityTypes = Array.isArray(config.entityType) 
          ? config.entityType 
          : [config.entityType];
        builder.matchMetadata(['entity', 'type'], entityTypes);
      }

      if (config.entityId) {
        const entityIds = Array.isArray(config.entityId) 
          ? config.entityId 
          : [config.entityId];
        builder.matchMetadata(['entity', 'id'], entityIds);
      }

      // Add additional where conditions to the pattern
      if (config.where) {
        Object.entries(config.where).forEach(([key, value]) => {
          if (value !== undefined) {
            builder.matchMetadata([key], value);
          }
        });
      }

      // Set up the workflow invocation with entity context
      builder.invokeWorkflow(workflowId);

      return builder.build();
    },
  };
}
