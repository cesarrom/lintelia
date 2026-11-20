import { createEvent } from './create-event';
import { LogCategory, LogLevel, type Workflow, type WorkflowExecution, type WorkflowTrigger } from '../../schemas';
import { EntityType, BaseEventData, ListenerConfig } from './types';

/**
 * Base interface for all workflow-related events
 */
interface BaseWorkflowEventData extends BaseEventData {
  // The ID of the tenant this workflow belongs to
  tenantId: string;
  // The user who triggered the event (if applicable)
  userId?: string;
  // Additional metadata
  [key: string]: unknown;
}

/**
 * Workflow management events
 */
export interface WorkflowManagementEventData extends BaseWorkflowEventData {
  // The workflow ID
  workflowId: string;
  // The workflow name
  name: string;
  // The workflow status
  status?: Workflow['status'];
  // The workflow description (optional)
  description?: string;
}

/**
 * Workflow execution events
 */
export interface WorkflowExecutionEventData extends BaseWorkflowEventData {
  // The execution ID
  executionId: string;
  // The workflow ID
  workflowId: string;
  // The execution status
  status: WorkflowExecution['status'];
  // The execution start time (ISO 8601)
  startedAt: string;
  // The execution end time (ISO 8601, if completed)
  completedAt?: string;
  // The execution result (if any)
  result?: unknown;
  // Error details (if failed)
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  // Execution metadata
  metadata?: Record<string, unknown>;
}

/**
 * Workflow trigger events
 */
export interface WorkflowTriggerEventData extends BaseWorkflowEventData {
  // The trigger ID
  triggerId: string;
  // The workflow ID
  workflowId: string;
  // The trigger type
  type: string;
  // The trigger status
  status: WorkflowTrigger['status'];
  // The trigger configuration
  config: Record<string, unknown>;
}

/**
 * Configuration for workflow event listeners
 */
export interface WorkflowListenerConfig<T extends BaseWorkflowEventData> 
  extends Omit<ListenerConfig<T>, 'where' | 'entityType'> {
  // Filter by workflow ID
  workflowId?: string | string[] | RegExp;
  // Filter by workflow status
  status?: Workflow['status'] | Workflow['status'][] | RegExp;
  // Filter by execution status (for execution events)
  executionStatus?: WorkflowExecution['status'] | WorkflowExecution['status'][] | RegExp;
  // Filter by trigger type (for trigger events)
  triggerType?: string | string[] | RegExp;
  // Additional custom filters
  where?: Partial<T>;
}

/**
 * Creates a workflow event with proper entity references
 */
function createWorkflowEvent<T extends BaseWorkflowEventData>(
  name: string, 
  category: LogCategory, 
  level: LogLevel,
  getEntityId?: (data: Workflow) => { workflowId: string } | undefined
) {
  return createEvent<Workflow, ListenerConfig<T>, { workflowId: string }>({
    name,
    category,
    level,
    source: 'workflow',
    getEntityRef: getEntityId,
  });
}

/**
 * Helper function to create a workflow event listener
 * @param event The workflow event to listen for
 * @param config Configuration for the listener
 * @param workflowId The ID of the workflow to trigger
 * @returns A trigger definition that can be used to listen for the event
 */
export function createWorkflowListener<T extends BaseWorkflowEventData>(
  event: {
    createListener: (config: ListenerConfig<T>, workflowId: string) => {
      id: string;
      name: string;
      type: string;
      description?: string;
      pattern: Record<string, unknown>;
      action: {
        type: string;
        workflowId: string;
        nodeId?: string;
      };
    };
  },
  config: WorkflowListenerConfig<T>,
  workflowId: string
) {
  const { workflowId: filterWorkflowId, status, executionStatus, triggerType, where, ...rest } = config;
  
  const listenerConfig: ListenerConfig<T> = {
    ...rest,
    entityType: EntityType.WORKFLOW,
    where: {
      ...(filterWorkflowId && { workflowId: filterWorkflowId }),
      ...(status && { status }),
      ...(executionStatus && { status: executionStatus }),
      ...(triggerType && { type: triggerType }),
      ...where,
    } as Partial<T>,
  };
  
  return event.createListener(listenerConfig, workflowId);
}

export const WorkflowEvents = {
  // Workflow Lifecycle
  WorkflowCreated: createWorkflowEvent<WorkflowManagementEventData>(
    'workflow.created',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowUpdated: createWorkflowEvent<WorkflowManagementEventData & { changes: Record<string, unknown> }>(
    'workflow.updated',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowDeleted: createWorkflowEvent<WorkflowManagementEventData>(
    'workflow.deleted',
    'workflow' as LogCategory,
    'warning' as LogLevel,
  ),
  
  // Workflow Execution
  WorkflowStarted: createWorkflowEvent<WorkflowExecutionEventData>(
    'workflow.started',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowCompleted: createWorkflowEvent<WorkflowExecutionEventData>(
    'workflow.completed',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowStepCompleted: createWorkflowEvent<WorkflowExecutionEventData & { 
    stepId: string; 
    stepName: string; 
    result?: unknown;
  }>(
    'workflow.step.completed',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowError: createWorkflowEvent<WorkflowExecutionEventData & { 
    error: string;
    stepId?: string;
  }>(
    'workflow.error',
    'workflow' as LogCategory,
    'error' as LogLevel,
  ),
  
  // Workflow Triggers
  WorkflowTriggerCreated: createWorkflowEvent<WorkflowTriggerEventData>(
    'workflow.trigger.created',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowTriggerUpdated: createWorkflowEvent<WorkflowTriggerEventData & { 
    changes: Record<string, unknown> 
  }>(
    'workflow.trigger.updated',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
  
  WorkflowTriggerDeleted: createWorkflowEvent<WorkflowTriggerEventData>(
    'workflow.trigger.deleted',
    'workflow' as LogCategory,
    'warning' as LogLevel,
  ),
  
  WorkflowTriggerFired: createWorkflowEvent<WorkflowTriggerEventData & { 
    payload: Record<string, unknown>;
  }>(
    'workflow.trigger.fired',
    'workflow' as LogCategory,
    'info' as LogLevel,
  ),
};

export default WorkflowEvents;
