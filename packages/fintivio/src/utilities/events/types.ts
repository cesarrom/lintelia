import type { Log, LogCategory, LogLevel, TriggerDefinition } from '../../schemas';

/**
 * Entity types that can be referenced in events
 * These should match the entity types defined in the schema files
 */
export enum EntityType {
  // From shared.schema.ts
  USER = 'user',
  ROLE = 'role',
  PERMISSION = 'permission',
  
  // From tenants.schema.ts
  EMAIL_TEMPLATE = 'email_template',
  FORM = 'form',
  FORM_ANSWER = 'form_answer',
  FORM_INSTANCE = 'form_instance',
  INVITATION = 'invitation',
  KEY_VALUE = 'key_value',
  LOG = 'log',
  REVIEW = 'review',
  SYSTEM_TRIGGER = 'system_trigger',
  SYSTEM_VARIABLE = 'system_variable',
  WORKFLOW = 'workflow',
  WORKFLOW_EXECUTION = 'workflow_execution',
  WORKFLOW_TRIGGER = 'workflow_trigger',
  DOCUMENT_TEMPLATE = 'document_template',
  DOCUMENT = 'document',
  
  // From globals.schema.ts
  ENVIRONMENT = 'environment',
  TENANT = 'tenant',
  
  // Integration entities
  INTEGRATION = 'integration',
}

/**
 * Base interface for all event data
 * All event data interfaces should extend this
 */
export interface BaseEventData {
  // The ID of the tenant this event belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

// Helper types for JSON serialization
type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type LogEntry<T> = Omit<Log, 'metadata'> & { metadata?: T };

/**
 * Configuration for an event listener
 * @template T The type of the event data this listener can handle
 */
export interface ListenerConfig<T extends BaseEventData = BaseEventData> {
  // Filter events by entity type
  entityType?: EntityType | EntityType[];
  // Filter events by entity ID (supports wildcards)
  entityId?: string | string[] | RegExp;
  // Additional filtering criteria
  where?: Partial<T>;
  // Whether to include system events (default: false)
  includeSystemEvents?: boolean;
}

/**
 * Represents an event in the application that can be logged and trigger workflows
 * 
 * The generic type parameter `T` represents the type of the data that will be logged with the event.
 * The generic type parameter `C` represents the type of the listener configuration.
 * 
 * The `log` method takes the event data and a workflow ID, and returns a log entry.
 * The `createListener` method takes a configuration object and a workflow ID,
 * and returns a trigger that will be activated when an event matching the configuration is logged.
 * 
 * This interface is used to define events in a type-safe way, ensuring that the data logged with an event
 * matches the expected type, and that listeners are created with the correct configuration.
 */
export interface AppEvent<T extends object, C extends ListenerConfig<any> = ListenerConfig<any>> {
  // The name of the event (e.g., 'user.created', 'document.updated')
  name: string;
  
  // Create a log entry for this event
  log: (data: T) => LogEntry<T>;
  
  // Create a trigger that will be activated when this event matches the given configuration
  createListener: (config: C, workflowId: string) => TriggerDefinition;
}

/**
 * Options for creating a new event
 * @template T The type of the event data
 */
export interface CreateEventOptions<T extends object, K extends object> {
  // The name of the event (e.g., 'user.created', 'document.updated')
  name: string;
  // The category of the event
  category: LogCategory;
  // The severity level of the event
  level: LogLevel;
  // The source of the event (default: 'system')
  source?: string;
  // The ID of the user who triggered the event (default: 'system')
  userId?: string;
  // Function to extract entity reference from event data
  getEntityRef?: (data: T) => K | undefined;
}

// Helper type for record with string keys
export type StringKeyRecord = Record<string, JsonValue>;
