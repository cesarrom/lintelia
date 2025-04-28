

import { events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";
import { workflowInject } from "@/lib/injector/utils";

export const wizardService = restate.object({
  name: "wizard",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({ }, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.end, executionId, globalResult: r, localResult: {}, workflowId, domain, token });
      }
    ),
  }
});

export type WizardService = typeof wizardService;