import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowInject } from "@/lib/injector/utils";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";

export const endService = restate.object({
  name: "end",  
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({}, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        const eventName = nodeData?.exports?.[0]?.event || 'done';
        // Emit the public URL event first
        return workflowExecutionsService.nextOrEndExecution({
          nodeData,
          event: eventName,
          executionId,
          localResult: {},
          globalResult: r,
          yaml,
          domain,
          token
        });
      }
    ),
  }
});

export type EndService = typeof endService;
