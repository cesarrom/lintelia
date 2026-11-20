import { createEvent } from './create-event';
import { LogCategory, LogLevel, SystemVariable, type TriggerDefinition } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all system-related events
 */
interface BaseSystemEventData extends BaseEventData {
  // The ID of the tenant this event belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * System variable events
 */
export interface SystemVariableEventData extends BaseSystemEventData {
  // The ID of the system variable
  variableId: string;
  // The name of the system variable
  name: string;
  // Optional value of the variable (for created/updated events)
  value?: unknown;
  // Optional previous value (for updated events)
  previousValue?: unknown;
}

/**
 * System configuration events
 */
export interface SystemConfigEventData extends BaseSystemEventData {
  // The component or area of the system being configured
  component: string;
  // The configuration key being changed
  key: string;
  // The new value
  value: unknown;
  // Optional previous value (for update events)
  previousValue?: unknown;
}

/**
 * System maintenance events
 */
export interface SystemMaintenanceEventData extends BaseSystemEventData {
  // The type of maintenance action
  action: 'started' | 'completed' | 'scheduled' | 'cancelled';
  // Description of the maintenance
  description: string;
  // Optional scheduled start time (for scheduled maintenance)
  scheduledStart?: string;
  // Optional scheduled end time (for scheduled maintenance)
  scheduledEnd?: string;
  // Optional reason for the maintenance
  reason?: string;
}

/**
 * Configuration for system event listeners
 */
export interface SystemListenerConfig<T extends BaseSystemEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType'> {
  // Filter by tenant ID
  tenantId?: string | string[];
  // Filter by component (for config events)
  component?: string | string[];
  // Filter by variable name (for variable events)
  variableName?: string | string[] | RegExp;
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a system event with proper entity references
 */
function createSystemEvent<T extends BaseSystemEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
  getEntityId?: (data: SystemVariable) => { systemVariableId: string } | undefined
) {
  return createEvent<SystemVariable, ListenerConfig<T>, { systemVariableId: string }>({
    name,
    category,
    level,
    source: 'system',
    getEntityRef: getEntityId,
  });
}

/**
 * Helper function to create a system event listener
 * @param event The system event to listen for
 * @param config Configuration for the listener
 * @param workflowId The ID of the workflow to trigger
 * @returns A trigger definition that can be used to listen for the event
 */
export function createSystemListener<T extends BaseSystemEventData>(
  event: {
    createListener: (config: ListenerConfig<T>, workflowId: string) => TriggerDefinition;
  },
  config: SystemListenerConfig<T>,
  workflowId: string
): TriggerDefinition {
  const { tenantId, component, variableName, where, ...rest } = config;
  
  const listenerConfig: ListenerConfig<T> = {
    ...rest,
    where: {
      ...(tenantId && { tenantId }),
      ...(component && { component }),
      ...(variableName && { name: variableName }),
      ...where,
    } as Partial<T>,
  };
  
  return event.createListener(listenerConfig, workflowId);
}

export const SystemEvents = {
  // System Variable Events
  SystemVariableCreated: createSystemEvent<SystemVariableEventData>(
    'system.variable.created',
    'system' as LogCategory,
    'info' as LogLevel,
  ),
  
  SystemVariableUpdated: createSystemEvent<SystemVariableEventData & { changes: Record<string, unknown> }>(
    'system.variable.updated',
    'system' as LogCategory,
    'info' as LogLevel,
  ),
  
  SystemVariableDeleted: createSystemEvent<SystemVariableEventData>(
    'system.variable.deleted',
    'system' as LogCategory,
    'warning' as LogLevel,
  ),
  
  // System Configuration Events
  ConfigUpdated: createSystemEvent<SystemConfigEventData>(
    'system.config.updated',
    'system' as LogCategory,
    'info' as LogLevel
  ),
  
  ConfigReset: createSystemEvent<SystemConfigEventData>(
    'system.config.reset',
    'system' as LogCategory,
    'warning' as LogLevel
  ),
  
  // System Maintenance Events
  MaintenanceStarted: createSystemEvent<SystemMaintenanceEventData>(
    'system.maintenance.started',
    'system' as LogCategory,
    'info' as LogLevel
  ),
  
  MaintenanceCompleted: createSystemEvent<SystemMaintenanceEventData>(
    'system.maintenance.completed',
    'system' as LogCategory,
    'info' as LogLevel
  ),
  
  MaintenanceScheduled: createSystemEvent<SystemMaintenanceEventData>(
    'system.maintenance.scheduled',
    'system' as LogCategory,
    'info' as LogLevel
  ),
  
  MaintenanceCancelled: createSystemEvent<SystemMaintenanceEventData>(
    'system.maintenance.cancelled',
    'system' as LogCategory,
    'warning' as LogLevel
  ),
  
  // System Health Events
  HealthCheckFailed: createSystemEvent<BaseSystemEventData & {
    checkName: string;
    error: string;
    details?: Record<string, unknown>;
  }>(
    'system.health.check_failed',
    'system' as LogCategory,
    'error' as LogLevel
  ),
  
  // System Alert Events
  AlertTriggered: createSystemEvent<BaseSystemEventData & {
    alertId: string;
    alertName: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: Record<string, unknown>;
  }>(
    'system.alert.triggered',
    'system' as LogCategory,
    'error' as LogLevel
  ),
  
  AlertResolved: createSystemEvent<BaseSystemEventData & {
    alertId: string;
    alertName: string;
    resolvedBy: string;
    resolutionNotes?: string;
  }>(
    'system.alert.resolved',
    'system' as LogCategory,
    'info' as LogLevel
  ),
};
