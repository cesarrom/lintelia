import { createEvent } from './create-event';
import { LogCategory, LogLevel } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig, AppEvent } from './types';
import type { JsonValue } from './types';

// Extend EntityType with database-specific types
declare module './types' {
  enum EntityType {
    TABLE = 'table',
    RECORD = 'record',
    // Other entity types...
  }
}

/**
 * Base interface for all database-related events
 */
interface BaseDatabaseEventData extends BaseEventData {
  // The ID of the table this event is about
  tableId: string;

  entity?: unknown;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Table operation events
 */
export interface TableEventData extends BaseDatabaseEventData {
  // The name of the table
  name: string;
  // The schema of the table (for created/updated events)
  schema?: JsonValue;
  // Changes made to the table (for updated events)
  changes?: Record<string, unknown>;
}

/**
 * Record operation events
 */
export interface RecordEventData extends BaseDatabaseEventData {
  // The ID of the record
  recordId: string;
  // The data of the record (for created/updated events)
  data?: Record<string, unknown>;
  // Changes made to the record (for updated events)
  changes?: Record<string, unknown>;
}

/**
 * Configuration for database event listeners
 */
export interface DatabaseListenerConfig<T extends BaseDatabaseEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType' | 'entityId'> {
  // Filter by table ID
  tableId?: string | string[] | RegExp;
  // Filter by record ID (for record events)
  recordId?: string | string[] | RegExp;
  // Filter by user ID
  userId?: string | string[];
  // Filter by tenant ID
  tenantId?: string | string[];
  // Entity type for the listener
  entityType?: EntityType;
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a database event with proper entity references
 */
function createDatabaseEvent<T extends BaseDatabaseEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
) {
  return createEvent<BaseDatabaseEventData, ListenerConfig<T>, { table: string; operation: string }>({
    name,
    category,
    level,
    source: 'database-service',
  });
}

export const DatabaseEvents = {
  // Table Operations
  TableCreated: createDatabaseEvent<TableEventData>(
    'database.table.created',
    'database' as LogCategory,
    'info' as LogLevel,
  ),
  
  TableUpdated: createDatabaseEvent<TableEventData & { changes: Record<string, unknown> }>(
    'database.table.updated',
    'database' as LogCategory,
    'info' as LogLevel,
  ),
  
  TableDeleted: createDatabaseEvent<TableEventData>(
    'database.table.deleted',
    'database' as LogCategory,
    'warning' as LogLevel,
  ),
  
  // Record Operations
  RecordCreated: createDatabaseEvent<RecordEventData>(
    'database.record.created',
    'database' as LogCategory,
    'info' as LogLevel,
  ),
  
  RecordUpdated: createDatabaseEvent<RecordEventData & { changes: Record<string, unknown> }>(
    'database.record.updated',
    'database' as LogCategory,
    'info' as LogLevel,
  ),
  
  RecordDeleted: createDatabaseEvent<RecordEventData>(
    'database.record.deleted',
    'database' as LogCategory,
    'info' as LogLevel,
  ),
  
  // Performance Events
  QueryExecuted: createDatabaseEvent<BaseDatabaseEventData & { operation: 'read' }>(
    'database.query.executed',
    'database' as LogCategory,
    'debug' as LogLevel,
  ),
} as const;

/**
 * Helper function to create a listener for database events
 */
export function createDatabaseListener<T extends BaseDatabaseEventData>(
  event: AppEvent<T>,
  config: DatabaseListenerConfig<T> & { workflowId: string },
  workflowId: string
) {
  // Extract the where clause from the config
  const { where: configWhere = {} as Partial<T>, ...restConfig } = config;
  
  // Create the new where object with the base config
  const newWhere: Record<string, unknown> = {};
  
  // Copy all properties from configWhere to newWhere
  if (configWhere && typeof configWhere === 'object') {
    Object.entries(configWhere).forEach(([key, value]) => {
      if (value !== undefined) {
        newWhere[key] = value;
      }
    });
  }

  // Add tableId to the where clause if provided
  if (config.tableId) {
    newWhere.tableId = config.tableId;
  }
  
  // Add recordId to the where clause if provided (for record events)
  if ('recordId' in config && config.recordId) {
    newWhere.recordId = config.recordId;
  }
  
  // Add tenantId to the where clause if provided
  if (config.tenantId) {
    newWhere.tenantId = config.tenantId;
  }

  // Determine the default entity type based on the config
  const defaultEntityType = 'recordId' in config && config.recordId ? EntityType.RECORD : EntityType.TABLE;

  // Create the listener config with proper typing
  const listenerConfig: ListenerConfig<T> = {
    ...restConfig,
    where: newWhere as unknown as Partial<T>,
    // Use the specified entity type or default based on the presence of recordId
    entityType: config.entityType ?? defaultEntityType,
  } as ListenerConfig<T>;

  return event.createListener(listenerConfig, workflowId);
};
