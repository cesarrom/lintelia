

import { events } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { WorkflowExecutionsService } from "@/lib/services";
import { workflowInject } from "@/lib/injector/utils";

export const wizardService = restate.object({
  name: "wizard",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({ }, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.end, executionId, globalResult: r, localResult: {}, yaml, domain, token });
      }
    ),
  }
});

export type WizardService = typeof wizardService;