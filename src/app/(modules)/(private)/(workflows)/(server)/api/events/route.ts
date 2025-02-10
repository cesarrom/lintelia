import { getContextualInjector } from "@/actions/injector";
import { WorkflowExecutionsService, WorkflowsService } from "@/lib/services";
import { NextRequest } from "next/server";
import { workflowTriggers } from "@/lib/models/platform.sql";
import { and, eq } from "drizzle-orm";
import { EventContext } from "@/types/schema";
import { PLATFORM_DB_TOKEN } from "@/lib/injector/tokens";
import { type PlatformDB } from "@/lib/services/tenants.service";

// Import all trigger executors
import { shouldExecute as shouldExecuteForm, execute as executeForm } from "@/components/workflow/triggers/forms/server/execute";
import { shouldExecute as shouldExecuteUser, execute as executeUser } from "@/components/workflow/triggers/users/server/execute";
import { shouldExecute as shouldExecuteApi, execute as executeApi } from "@/components/workflow/triggers/api/server/execute";
import { shouldExecute as shouldExecuteDatabase, execute as executeDatabase } from "@/components/workflow/triggers/database/server/execute";
import { shouldExecute as shouldExecuteTransaction, execute as executeTransaction } from "@/components/workflow/triggers/transactions/server/execute";

// Map of trigger types to their executors
const triggerExecutors: Record<string, {
  shouldExecute: (event: EventContext, config: unknown) => Promise<boolean>;
  execute: (event: EventContext, config: unknown) => Promise<{ success: boolean; outputs: unknown }>;
}> = {
  form: {
    shouldExecute: shouldExecuteForm,
    execute: executeForm,
  },
  user: {
    shouldExecute: shouldExecuteUser,
    execute: executeUser,
  },
  api: {
    shouldExecute: shouldExecuteApi,
    execute: executeApi,
  },
  database: {
    shouldExecute: shouldExecuteDatabase,
    execute: executeDatabase,
  },
  transaction: {
    shouldExecute: shouldExecuteTransaction,
    execute: executeTransaction,
  },
};

const handleEvent = async (domain: string, eventName: string, payload: unknown) => {
  const { injector } = await getContextualInjector(domain);
  const db = injector.resolve<PlatformDB>(PLATFORM_DB_TOKEN);
  const workflowExecutionService = injector.resolve(WorkflowExecutionsService);
  const workflowService = injector.resolve(WorkflowsService);

  // Find all active triggers that match this event
  const matchingTriggers = await db
    .select()
    .from(workflowTriggers)
    .where(
      and(
        eq(workflowTriggers.eventName, eventName),
        eq(workflowTriggers.status, 'active')
      )
    );

  // For each matching trigger, check if it should execute
  for (const trigger of matchingTriggers) {
    const executor = triggerExecutors[trigger.type];
    if (!executor) {
      console.warn(`No executor found for trigger type: ${trigger.type}`);
      continue;
    }

    const event: EventContext = {
      domain,
      type: 'event',
      eventName,
      payload,
      createdAt: Date.now(),
    };

    try {
      // Check if the trigger conditions are met
      const shouldExecute = await executor.shouldExecute(event, trigger.config);
      
      if (!shouldExecute) continue;

      // Execute the trigger
      const result = await executor.execute(event, trigger.config);

      if (!result.success) continue;

      // Load the workflow
      const workflow = await workflowService.loadWorkflow(trigger.workflowId);
      if (workflow.status !== 'active') continue;

      // Create a new workflow execution
      await workflowExecutionService.createExecution({
        workflowId: trigger.workflowId,
        triggeredBy: trigger.createdBy, // Use trigger creator as the executor
        triggeredByRole: 'system', // System role since this is automated
        executingVersion: workflow.version,
        inputs: {
          event: {
            name: eventName,
            payload,
            triggeredAt: new Date().toISOString(),
            triggerId: trigger.id,
          }
        },
      });
    } catch (error) {
      console.error(`Error processing trigger ${trigger.id}:`, error);
      continue;
    }
  }

  return new Response(null, { status: 202 }); // Accepted
};

export const POST = async (req: NextRequest) => {
  const { domain, eventName, payload } = await req.json();
  return handleEvent(domain, eventName, payload);
};
